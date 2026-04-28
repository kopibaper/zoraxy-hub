package main

import (
	"bytes"
	"crypto/subtle"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const agentVersion = "2.0.0"
const sessionTTL = 10 * time.Minute

var dockerNameRE = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)
var dockerSinceRE = regexp.MustCompile(`^[A-Za-z0-9._:-]+$`)

type Config struct {
	APIKey       string       `json:"apiKey"`
	ListenAddr   string       `json:"listenAddr"`
	ListenPort   int          `json:"listenPort"`
	TLS          *TLSConfig   `json:"tls,omitempty"`
	Zoraxy       ZoraxyConfig `json:"zoraxy"`
	ZoraxyDataDir string      `json:"zoraxyDataDir"`
	Docker       DockerConfig `json:"docker"`
}

type TLSConfig struct {
	Cert string `json:"cert"`
	Key  string `json:"key"`
}

type ZoraxyConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type DockerConfig struct {
	Enabled       bool   `json:"enabled"`
	ContainerName string `json:"containerName"`
}

type ZoraxySession struct {
	cookie    string
	csrfToken string
	expiresAt time.Time
	mu        sync.Mutex
}

type ZoraxyClient struct {
	baseURL  string
	username string
	password string
	session  ZoraxySession
	http     *http.Client
}

func NewZoraxyClient(cfg ZoraxyConfig) *ZoraxyClient {
	return &ZoraxyClient{
		baseURL:  fmt.Sprintf("http://%s:%d", cfg.Host, cfg.Port),
		username: cfg.Username,
		password: cfg.Password,
		http: &http.Client{
			Timeout: 15 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

func (c *ZoraxyClient) authenticate() error {
	if c.username == "" || c.password == "" {
		return fmt.Errorf("missing zoraxy username or password")
	}

	req, err := http.NewRequest("GET", c.baseURL+"/login.html", nil)
	if err != nil {
		return err
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("cannot reach zoraxy login page: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("zoraxy login page returned HTTP %d", resp.StatusCode)
	}

	var csrfCookie string
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "zoraxy_csrf" {
			csrfCookie = cookie.Name + "=" + cookie.Value
			break
		}
	}
	if csrfCookie == "" {
		setCookie := resp.Header.Get("Set-Cookie")
		if setCookie != "" {
			csrfCookie = strings.Split(setCookie, ";")[0]
		}
	}
	if csrfCookie == "" {
		return fmt.Errorf("zoraxy did not return a CSRF cookie")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	csrfRE := regexp.MustCompile(`zoraxy\.csrf\.Token[^>]*content="([^"]+)"`)
	matches := csrfRE.FindSubmatch(body)
	if matches == nil {
		return fmt.Errorf("cannot extract CSRF token from zoraxy login page")
	}
	csrfToken := string(matches[1])

	form := url.Values{}
	form.Set("username", c.username)
	form.Set("password", c.password)

	loginReq, err := http.NewRequest("POST", c.baseURL+"/api/auth/login", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	loginReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	loginReq.Header.Set("Cookie", csrfCookie)
	loginReq.Header.Set("X-CSRF-Token", csrfToken)

	loginResp, err := c.http.Do(loginReq)
	if err != nil {
		return fmt.Errorf("zoraxy login request failed: %w", err)
	}
	defer loginResp.Body.Close()

	loginBody, _ := io.ReadAll(loginResp.Body)

	if loginResp.StatusCode == 403 {
		return fmt.Errorf("zoraxy CSRF validation failed: %s", string(loginBody))
	}

	if len(loginBody) > 0 && loginBody[0] == '{' {
		var parsed map[string]interface{}
		if json.Unmarshal(loginBody, &parsed) == nil {
			if errVal, ok := parsed["error"]; ok && errVal != nil {
				return fmt.Errorf("zoraxy login rejected: %v", errVal)
			}
		}
	}

	var sessionCookie string
	for _, cookie := range loginResp.Cookies() {
		if cookie.Name == "Zoraxy" {
			sessionCookie = cookie.Name + "=" + cookie.Value
			break
		}
	}
	if sessionCookie == "" {
		setCookie := loginResp.Header.Get("Set-Cookie")
		if setCookie != "" {
			sessionCookie = strings.Split(setCookie, ";")[0]
		}
	}

	combinedCookie := csrfCookie
	if sessionCookie != "" {
		combinedCookie = csrfCookie + "; " + sessionCookie
	}

	c.session.cookie = combinedCookie
	c.session.csrfToken = csrfToken
	c.session.expiresAt = time.Now().Add(sessionTTL)
	return nil
}

func (c *ZoraxyClient) ensureSession() error {
	c.session.mu.Lock()
	defer c.session.mu.Unlock()

	if c.session.cookie == "" || c.session.csrfToken == "" || time.Now().After(c.session.expiresAt) {
		return c.authenticate()
	}
	return nil
}

func (c *ZoraxyClient) clearSession() {
	c.session.mu.Lock()
	defer c.session.mu.Unlock()
	c.session.cookie = ""
	c.session.csrfToken = ""
	c.session.expiresAt = time.Time{}
}

func (c *ZoraxyClient) request(method, path string, formBody map[string]string, isRetry bool) (json.RawMessage, error) {
	if err := c.ensureSession(); err != nil {
		return nil, err
	}

	var bodyReader io.Reader
	if formBody != nil && method != "GET" {
		form := url.Values{}
		for k, v := range formBody {
			form.Set(k, v)
		}
		bodyReader = strings.NewReader(form.Encode())
	}

	req, err := http.NewRequest(method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, err
	}

	c.session.mu.Lock()
	req.Header.Set("Cookie", c.session.cookie)
	if method != "GET" {
		req.Header.Set("X-CSRF-Token", c.session.csrfToken)
		if formBody != nil {
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}
	}
	c.session.mu.Unlock()

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if (resp.StatusCode == 401 || resp.StatusCode == 403) && !isRetry {
		c.clearSession()
		return c.request(method, path, formBody, true)
	}

	if resp.StatusCode >= 400 {
		var parsed map[string]interface{}
		if json.Unmarshal(respBody, &parsed) == nil {
			if errVal, ok := parsed["error"]; ok {
				return nil, fmt.Errorf("%v", errVal)
			}
		}
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	return json.RawMessage(respBody), nil
}

func (c *ZoraxyClient) requestMultipart(path string, fields map[string]string, files map[string][]byte) (json.RawMessage, error) {
	if err := c.ensureSession(); err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	for k, v := range fields {
		_ = writer.WriteField(k, v)
	}
	for name, data := range files {
		part, err := writer.CreateFormFile(name, name+".pem")
		if err != nil {
			return nil, err
		}
		_, _ = part.Write(data)
	}
	_ = writer.Close()

	req, err := http.NewRequest("POST", c.baseURL+path, &buf)
	if err != nil {
		return nil, err
	}

	c.session.mu.Lock()
	req.Header.Set("Cookie", c.session.cookie)
	req.Header.Set("X-CSRF-Token", c.session.csrfToken)
	c.session.mu.Unlock()
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	return json.RawMessage(respBody), nil
}

func str(params map[string]interface{}, key string) string {
	if v, ok := params[key]; ok {
		return fmt.Sprintf("%v", v)
	}
	return ""
}

func boolStr(params map[string]interface{}, key string) string {
	v := str(params, key)
	if v == "true" || v == "1" {
		return "true"
	}
	return "false"
}

func (c *ZoraxyClient) Call(method string, params map[string]interface{}) (json.RawMessage, error) {
	switch method {
	case "proxy.list":
		return c.request("GET", "/api/proxy/list?type=host", nil, false)
	case "proxy.detail":
		return c.request("POST", "/api/proxy/detail", map[string]string{
			"type": "host", "rootname": str(params, "domain"),
		}, false)
	case "proxy.add":
		return c.request("POST", "/api/proxy/add", map[string]string{
			"type": str(params, "proxyType"), "rootname": str(params, "rootDomain"),
			"origin": str(params, "origin"), "tls": boolStr(params, "requireTLS"),
		}, false)
	case "proxy.delete":
		return c.request("POST", "/api/proxy/del", map[string]string{
			"ep": str(params, "domain"),
		}, false)
	case "proxy.toggle":
		return c.request("POST", "/api/proxy/toggle", map[string]string{
			"ep": str(params, "domain"), "enabled": boolStr(params, "enabled"),
		}, false)
	case "proxy.edit":
		form := map[string]string{"ep": str(params, "domain")}
		if updates, ok := params["updates"].(map[string]interface{}); ok {
			for k, v := range updates {
				form[k] = fmt.Sprintf("%v", v)
			}
		}
		return c.request("POST", "/api/proxy/edit", form, false)
	case "upstream.list":
		return c.request("POST", "/api/proxy/upstream/list", map[string]string{
			"ep": str(params, "domain"),
		}, false)
	case "upstream.add":
		return c.request("POST", "/api/proxy/upstream/add", map[string]string{
			"ep": str(params, "domain"), "origin": str(params, "origin"),
			"tls": boolStr(params, "requireTLS"), "tlsval": boolStr(params, "skipCertValidation"),
			"weight": str(params, "weight"),
		}, false)
	case "upstream.remove":
		return c.request("POST", "/api/proxy/upstream/remove", map[string]string{
			"ep": str(params, "domain"), "origin": str(params, "origin"),
		}, false)
	case "vdir.add":
		return c.request("POST", "/api/proxy/vdir/add", map[string]string{
			"ep": str(params, "rootDomain"), "matchingPath": str(params, "matchingPath"),
			"domain": str(params, "domain"), "tls": boolStr(params, "requireTLS"),
			"skipCertValidation": boolStr(params, "skipCertValidation"),
		}, false)
	case "vdir.delete":
		return c.request("POST", "/api/proxy/vdir/del", map[string]string{
			"ep": str(params, "rootDomain"), "matchingPath": str(params, "matchingPath"),
		}, false)
	case "header.add":
		return c.request("POST", "/api/proxy/header/add", map[string]string{
			"ep": str(params, "rootDomain"), "direction": str(params, "direction"),
			"name": str(params, "key"), "value": str(params, "value"),
			"isRemove": boolStr(params, "isRemove"),
		}, false)
	case "header.delete":
		return c.request("POST", "/api/proxy/header/remove", map[string]string{
			"ep": str(params, "rootDomain"), "direction": str(params, "direction"),
			"name": str(params, "key"),
		}, false)
	case "alias.set":
		aliases := ""
		if arr, ok := params["aliases"].([]interface{}); ok {
			parts := make([]string, len(arr))
			for i, v := range arr {
				parts[i] = fmt.Sprintf("%v", v)
			}
			aliases = strings.Join(parts, ",")
		}
		return c.request("POST", "/api/proxy/setAlias", map[string]string{
			"ep": str(params, "rootDomain"), "alias": aliases,
		}, false)
	case "cert.list":
		return c.request("GET", "/api/cert/list", nil, false)
	case "cert.upload":
		return c.requestMultipart("/api/cert/upload",
			map[string]string{"domain": str(params, "domain")},
			map[string][]byte{
				"cert": []byte(str(params, "certPem")),
				"key":  []byte(str(params, "keyPem")),
			})
	case "cert.delete":
		return c.request("POST", "/api/cert/delete", map[string]string{
			"domain": str(params, "domain"),
		}, false)
	case "acme.obtain":
		domains := ""
		if arr, ok := params["domains"].([]interface{}); ok {
			parts := make([]string, len(arr))
			for i, v := range arr {
				parts[i] = fmt.Sprintf("%v", v)
			}
			domains = strings.Join(parts, ",")
		}
		return c.request("POST", "/api/acme/obtainCert", map[string]string{
			"domains": domains, "email": str(params, "email"),
		}, false)
	case "access.list":
		return c.request("GET", "/api/access/list", nil, false)
	case "blacklist.add":
		return c.request("POST", "/api/blacklist/add", map[string]string{
			"id": str(params, "ruleId"), "ip": str(params, "ip"), "comment": str(params, "comment"),
		}, false)
	case "whitelist.add":
		return c.request("POST", "/api/whitelist/add", map[string]string{
			"id": str(params, "ruleId"), "ip": str(params, "ip"), "comment": str(params, "comment"),
		}, false)
	case "blacklist.get":
		return c.request("POST", "/api/blacklist/list", map[string]string{
			"id": str(params, "ruleId"),
		}, false)
	case "whitelist.get":
		return c.request("POST", "/api/whitelist/list", map[string]string{
			"id": str(params, "ruleId"),
		}, false)
	case "blacklist.remove":
		return c.request("POST", "/api/blacklist/remove", map[string]string{
			"id": str(params, "ruleId"), "ip": str(params, "ip"),
		}, false)
	case "whitelist.remove":
		return c.request("POST", "/api/whitelist/remove", map[string]string{
			"id": str(params, "ruleId"), "ip": str(params, "ip"),
		}, false)
	case "stream.list":
		return c.request("GET", "/api/streamprox/list", nil, false)
	case "stream.add":
		form := make(map[string]string)
		for k, v := range params {
			form[k] = fmt.Sprintf("%v", v)
		}
		return c.request("POST", "/api/streamprox/add", form, false)
	case "stream.remove":
		return c.request("POST", "/api/streamprox/remove", map[string]string{"id": str(params, "id")}, false)
	case "stream.start":
		return c.request("POST", "/api/streamprox/start", map[string]string{"id": str(params, "id")}, false)
	case "stream.stop":
		return c.request("POST", "/api/streamprox/stop", map[string]string{"id": str(params, "id")}, false)
	case "redirect.list":
		return c.request("GET", "/api/redirect/list", nil, false)
	case "redirect.add":
		return c.request("POST", "/api/redirect/add", map[string]string{
			"redirectUrl": str(params, "redirectUrl"), "destUrl": str(params, "destUrl"),
			"statusCode": str(params, "statusCode"),
		}, false)
	case "redirect.delete":
		return c.request("POST", "/api/redirect/delete", map[string]string{"id": str(params, "id")}, false)
	case "redirect.edit":
		return c.request("POST", "/api/redirect/edit", map[string]string{
			"id": str(params, "id"), "redirectUrl": str(params, "redirectUrl"),
			"destUrl": str(params, "destUrl"), "statusCode": str(params, "statusCode"),
			"forwardChildpath": boolStr(params, "forwardChildpath"),
		}, false)
	case "stats.summary":
		return c.request("GET", "/api/stats/summary", nil, false)
	case "stats.netstat":
		return c.request("GET", "/api/stats/netstat", nil, false)
	case "stats.uptime":
		return c.request("GET", "/api/utm/list", nil, false)
	case "system.info":
		return c.request("GET", "/api/info/x", nil, false)
	case "config.export":
		return c.request("GET", "/api/conf/export", nil, false)
	case "acme.autoRenewDomains":
		return c.request("GET", "/api/acme/autoRenew/listDomains", nil, false)
	default:
		return nil, fmt.Errorf("unsupported method: %s", method)
	}
}

func (c *ZoraxyClient) RawRequest(method, path string, body map[string]string) (json.RawMessage, error) {
	return c.request(method, path, body, false)
}

func loadConfig() (*Config, error) {
	configPath := filepath.Join(getWorkDir(), "agent.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("cannot read agent.json: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("invalid agent.json: %w", err)
	}

	if env := os.Getenv("AGENT_API_KEY"); env != "" {
		cfg.APIKey = env
	}
	if env := os.Getenv("AGENT_PORT"); env != "" {
		if p, err := strconv.Atoi(env); err == nil {
			cfg.ListenPort = p
		}
	}
	if env := os.Getenv("ZORAXY_HOST"); env != "" {
		cfg.Zoraxy.Host = env
	}
	if env := os.Getenv("ZORAXY_PORT"); env != "" {
		if p, err := strconv.Atoi(env); err == nil {
			cfg.Zoraxy.Port = p
		}
	}
	if env := os.Getenv("ZORAXY_USERNAME"); env != "" {
		cfg.Zoraxy.Username = env
	}
	if env := os.Getenv("ZORAXY_PASSWORD"); env != "" {
		cfg.Zoraxy.Password = env
	}
	if env := os.Getenv("ZORAXY_DATA_DIR"); env != "" {
		cfg.ZoraxyDataDir = env
	}
	if env := os.Getenv("DOCKER_CONTAINER"); env != "" {
		cfg.Docker.ContainerName = env
	}

	if cfg.APIKey == "" {
		return nil, fmt.Errorf("missing apiKey in agent.json or AGENT_API_KEY env")
	}
	if cfg.ListenAddr == "" {
		cfg.ListenAddr = "0.0.0.0"
	}
	if cfg.ListenPort == 0 {
		cfg.ListenPort = 9191
	}
	if cfg.Zoraxy.Host == "" {
		cfg.Zoraxy.Host = "localhost"
	}
	if cfg.Zoraxy.Port == 0 {
		cfg.Zoraxy.Port = 8000
	}
	if cfg.ZoraxyDataDir == "" {
		cfg.ZoraxyDataDir = "/opt/zoraxy"
	}
	if cfg.Docker.ContainerName == "" {
		cfg.Docker.ContainerName = "zoraxy"
	}
	if !dockerNameRE.MatchString(cfg.Docker.ContainerName) {
		return nil, fmt.Errorf("invalid docker container name: %s", cfg.Docker.ContainerName)
	}

	return &cfg, nil
}

func getWorkDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

func jsonOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "data": data})
}

func jsonErr(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{"ok": false, "error": msg})
}

func authValid(r *http.Request, apiKey string) bool {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return false
	}
	token := auth[7:]
	if len(token) != len(apiKey) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(apiKey)) == 1
}

func runCmd(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	if err != nil {
		return strings.TrimSpace(string(out)), fmt.Errorf("%s: %s", err, strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}

func safePath(root, rel string) (string, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	target, err := filepath.Abs(filepath.Join(absRoot, rel))
	if err != nil {
		return "", err
	}
	if target != absRoot && !strings.HasPrefix(target, absRoot+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes sandbox root")
	}
	return target, nil
}

type sysInfo struct {
	Hostname         string  `json:"hostname"`
	Platform         string  `json:"platform"`
	Arch             string  `json:"arch"`
	CPUCount         int     `json:"cpuCount"`
	CPUUsagePercent  float64 `json:"cpuUsagePercent"`
	MemoryTotal      uint64  `json:"memoryTotal"`
	MemoryFree       uint64  `json:"memoryFree"`
	MemoryUsedPercent float64 `json:"memoryUsedPercent"`
	DiskTotal        uint64  `json:"diskTotal"`
	DiskFree         uint64  `json:"diskFree"`
	UptimeSeconds    int64   `json:"uptimeSeconds"`
	AgentVersion     string  `json:"agentVersion"`
}

func getMemInfo() (total, free uint64) {
	if runtime.GOOS != "linux" {
		return 0, 0
	}
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0
	}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		val, _ := strconv.ParseUint(fields[1], 10, 64)
		val *= 1024
		switch fields[0] {
		case "MemTotal:":
			total = val
		case "MemAvailable:":
			free = val
		}
	}
	return
}

func getDiskInfo() (total, free uint64) {
	if runtime.GOOS != "linux" {
		return 0, 0
	}
	out, err := exec.Command("df", "-B1", "/").CombinedOutput()
	if err != nil {
		return 0, 0
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) < 2 {
		return 0, 0
	}
	fields := strings.Fields(lines[1])
	if len(fields) < 4 {
		return 0, 0
	}
	total, _ = strconv.ParseUint(fields[1], 10, 64)
	free, _ = strconv.ParseUint(fields[3], 10, 64)
	return
}

func getUptime() int64 {
	if runtime.GOOS != "linux" {
		return 0
	}
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) < 1 {
		return 0
	}
	val, _ := strconv.ParseFloat(fields[0], 64)
	return int64(val)
}

func getCPUUsage() float64 {
	if runtime.GOOS != "linux" {
		return 0
	}
	read := func() (idle, total uint64) {
		data, err := os.ReadFile("/proc/stat")
		if err != nil {
			return
		}
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "cpu ") {
				fields := strings.Fields(line)
				if len(fields) < 5 {
					return
				}
				var sum uint64
				for _, f := range fields[1:] {
					v, _ := strconv.ParseUint(f, 10, 64)
					sum += v
				}
				idleVal, _ := strconv.ParseUint(fields[4], 10, 64)
				return idleVal, sum
			}
		}
		return
	}

	idle1, total1 := read()
	time.Sleep(200 * time.Millisecond)
	idle2, total2 := read()

	idleDelta := float64(idle2 - idle1)
	totalDelta := float64(total2 - total1)
	if totalDelta <= 0 {
		return 0
	}
	return ((totalDelta - idleDelta) / totalDelta) * 100
}

func getSysInfo() sysInfo {
	hostname, _ := os.Hostname()
	memTotal, memFree := getMemInfo()
	diskTotal, diskFree := getDiskInfo()
	cpuUsage := getCPUUsage()

	var memUsedPct float64
	if memTotal > 0 {
		memUsedPct = float64(memTotal-memFree) / float64(memTotal) * 100
	}

	return sysInfo{
		Hostname:         hostname,
		Platform:         runtime.GOOS,
		Arch:             runtime.GOARCH,
		CPUCount:         runtime.NumCPU(),
		CPUUsagePercent:  cpuUsage,
		MemoryTotal:      memTotal,
		MemoryFree:       memFree,
		MemoryUsedPercent: memUsedPct,
		DiskTotal:        diskTotal,
		DiskFree:         diskFree,
		UptimeSeconds:    getUptime(),
		AgentVersion:     agentVersion,
	}
}

func readJSONBody(r *http.Request) (map[string]interface{}, error) {
	if r.Body == nil {
		return nil, fmt.Errorf("empty request body")
	}
	defer r.Body.Close()
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("invalid JSON body: %w", err)
	}
	return body, nil
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("Config error: %v", err)
	}

	client := NewZoraxyClient(cfg.Zoraxy)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/ping", func(w http.ResponseWriter, r *http.Request) {
		jsonOK(w, map[string]interface{}{
			"agent": "zoraxy-agent", "version": agentVersion, "timestamp": time.Now().UnixMilli(),
		})
	})

	auth := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if !authValid(r, cfg.APIKey) {
				jsonErr(w, "Unauthorized", 401)
				return
			}
			next(w, r)
		}
	}

	mux.HandleFunc("GET /api/v1/info", auth(func(w http.ResponseWriter, r *http.Request) {
		jsonOK(w, getSysInfo())
	}))

	mux.HandleFunc("POST /api/v1/rpc", auth(func(w http.ResponseWriter, r *http.Request) {
		body, err := readJSONBody(r)
		if err != nil {
			jsonErr(w, err.Error(), 400)
			return
		}
		method, _ := body["method"].(string)
		if method == "" {
			jsonErr(w, "missing method", 400)
			return
		}
		params, _ := body["params"].(map[string]interface{})
		if params == nil {
			params = map[string]interface{}{}
		}
		result, err := client.Call(method, params)
		if err != nil {
			jsonErr(w, err.Error(), 502)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "data": json.RawMessage(result)})
	}))

	mux.HandleFunc("POST /api/v1/zoraxy", auth(func(w http.ResponseWriter, r *http.Request) {
		body, err := readJSONBody(r)
		if err != nil {
			jsonErr(w, err.Error(), 400)
			return
		}
		method := strings.ToUpper(fmt.Sprintf("%v", body["method"]))
		path, _ := body["path"].(string)
		if method != "GET" && method != "POST" {
			jsonErr(w, "method must be GET or POST", 400)
			return
		}
		if !strings.HasPrefix(path, "/") {
			jsonErr(w, "path must start with /", 400)
			return
		}
		var formBody map[string]string
		if bodyMap, ok := body["body"].(map[string]interface{}); ok {
			formBody = make(map[string]string)
			for k, v := range bodyMap {
				formBody[k] = fmt.Sprintf("%v", v)
			}
		}
		result, err := client.RawRequest(method, path, formBody)
		if err != nil {
			jsonErr(w, err.Error(), 502)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "data": json.RawMessage(result)})
	}))

	mux.HandleFunc("GET /api/v1/docker/status", auth(func(w http.ResponseWriter, r *http.Request) {
		if !cfg.Docker.Enabled {
			jsonErr(w, "docker integration disabled", 403)
			return
		}
		name := cfg.Docker.ContainerName
		out, err := runCmd("docker", "inspect", "--format", "{{json .}}", name)
		if err != nil {
			jsonOK(w, map[string]interface{}{"status": "not_found"})
			return
		}
		var data struct {
			ID     string `json:"Id"`
			Config struct {
				Image string `json:"Image"`
			} `json:"Config"`
			State struct {
				Status    string `json:"Status"`
				StartedAt string `json:"StartedAt"`
			} `json:"State"`
		}
		if json.Unmarshal([]byte(out), &data) != nil {
			jsonOK(w, map[string]interface{}{"status": "unknown"})
			return
		}
		jsonOK(w, map[string]interface{}{
			"status": data.State.Status, "id": data.ID,
			"image": data.Config.Image, "startedAt": data.State.StartedAt,
		})
	}))

	dockerAction := func(action string) http.HandlerFunc {
		return auth(func(w http.ResponseWriter, r *http.Request) {
			if !cfg.Docker.Enabled {
				jsonErr(w, "docker integration disabled", 403)
				return
			}
			_, err := runCmd("docker", action, cfg.Docker.ContainerName)
			if err != nil {
				jsonErr(w, err.Error(), 500)
				return
			}
			jsonOK(w, map[string]interface{}{action + "ed": true, "container": cfg.Docker.ContainerName})
		})
	}

	mux.HandleFunc("POST /api/v1/docker/restart", dockerAction("restart"))
	mux.HandleFunc("POST /api/v1/docker/stop", dockerAction("stop"))
	mux.HandleFunc("POST /api/v1/docker/start", dockerAction("start"))

	mux.HandleFunc("GET /api/v1/docker/logs", auth(func(w http.ResponseWriter, r *http.Request) {
		if !cfg.Docker.Enabled {
			jsonErr(w, "docker integration disabled", 403)
			return
		}
		tail := r.URL.Query().Get("tail")
		if tail == "" {
			tail = "100"
		}
		tailN, err := strconv.Atoi(tail)
		if err != nil || tailN < 1 {
			tailN = 100
		}
		if tailN > 5000 {
			tailN = 5000
		}
		args := []string{"logs", "--tail", strconv.Itoa(tailN)}
		if since := r.URL.Query().Get("since"); since != "" {
			if !dockerSinceRE.MatchString(since) {
				jsonErr(w, "invalid since parameter", 400)
				return
			}
			args = append(args, "--since", since)
		}
		args = append(args, cfg.Docker.ContainerName)
		out, _ := runCmd("docker", args...)
		jsonOK(w, map[string]interface{}{"logs": out})
	}))

	serviceAction := func(action string) http.HandlerFunc {
		return auth(func(w http.ResponseWriter, r *http.Request) {
			if cfg.Docker.Enabled {
				jsonErr(w, "service controls only available when docker.enabled is false", 403)
				return
			}
			_, err := runCmd("systemctl", action, "zoraxy")
			if err != nil {
				jsonErr(w, err.Error(), 500)
				return
			}
			jsonOK(w, map[string]interface{}{action + "ed": true, "service": "zoraxy"})
		})
	}

	mux.HandleFunc("POST /api/v1/service/restart", serviceAction("restart"))
	mux.HandleFunc("POST /api/v1/service/stop", serviceAction("stop"))
	mux.HandleFunc("POST /api/v1/service/start", serviceAction("start"))

	mux.HandleFunc("GET /api/v1/service/status", auth(func(w http.ResponseWriter, r *http.Request) {
		if cfg.Docker.Enabled {
			jsonErr(w, "service controls only available when docker.enabled is false", 403)
			return
		}
		active, _ := runCmd("systemctl", "is-active", "zoraxy")
		pidStr, _ := runCmd("systemctl", "show", "-p", "MainPID", "--value", "zoraxy")
		pid, _ := strconv.Atoi(pidStr)
		var uptimeSec int64
		if pid > 0 {
			etimes, _ := runCmd("ps", "-p", strconv.Itoa(pid), "-o", "etimes=")
			uptimeSec, _ = strconv.ParseInt(strings.TrimSpace(etimes), 10, 64)
		}
		jsonOK(w, map[string]interface{}{
			"running": active == "active" && pid > 0,
			"pid":     pid,
			"uptimeSeconds": uptimeSec,
		})
	}))

	mux.HandleFunc("GET /api/v1/files", auth(func(w http.ResponseWriter, r *http.Request) {
		relPath := r.URL.Query().Get("path")
		if relPath == "" {
			relPath = "."
		}
		target, err := safePath(cfg.ZoraxyDataDir, relPath)
		if err != nil {
			jsonErr(w, err.Error(), 403)
			return
		}
		entries, err := os.ReadDir(target)
		if err != nil {
			jsonErr(w, err.Error(), 404)
			return
		}
		result := make([]map[string]interface{}, 0, len(entries))
		for _, e := range entries {
			info, err := e.Info()
			if err != nil {
				continue
			}
			result = append(result, map[string]interface{}{
				"name":        e.Name(),
				"isDirectory": e.IsDir(),
				"size":        info.Size(),
				"modified":    info.ModTime().UnixMilli(),
			})
		}
		jsonOK(w, result)
	}))

	mux.HandleFunc("GET /api/v1/files/read", auth(func(w http.ResponseWriter, r *http.Request) {
		relPath := r.URL.Query().Get("path")
		if relPath == "" {
			jsonErr(w, "missing path query parameter", 400)
			return
		}
		target, err := safePath(cfg.ZoraxyDataDir, relPath)
		if err != nil {
			jsonErr(w, err.Error(), 403)
			return
		}
		content, err := os.ReadFile(target)
		if err != nil {
			jsonErr(w, err.Error(), 404)
			return
		}
		jsonOK(w, map[string]interface{}{"path": relPath, "content": string(content)})
	}))

	mux.HandleFunc("PUT /api/v1/files/write", auth(func(w http.ResponseWriter, r *http.Request) {
		body, err := readJSONBody(r)
		if err != nil {
			jsonErr(w, err.Error(), 400)
			return
		}
		relPath, _ := body["path"].(string)
		content, _ := body["content"].(string)
		if relPath == "" {
			jsonErr(w, "missing path", 400)
			return
		}
		target, err := safePath(cfg.ZoraxyDataDir, relPath)
		if err != nil {
			jsonErr(w, err.Error(), 403)
			return
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			jsonErr(w, err.Error(), 500)
			return
		}
		if err := os.WriteFile(target, []byte(content), 0644); err != nil {
			jsonErr(w, err.Error(), 500)
			return
		}
		jsonOK(w, map[string]interface{}{"written": true, "path": relPath, "bytes": len(content)})
	}))

	mux.HandleFunc("DELETE /api/v1/files/delete", auth(func(w http.ResponseWriter, r *http.Request) {
		body, err := readJSONBody(r)
		if err != nil {
			jsonErr(w, err.Error(), 400)
			return
		}
		relPath, _ := body["path"].(string)
		if relPath == "" {
			jsonErr(w, "missing path", 400)
			return
		}
		target, err := safePath(cfg.ZoraxyDataDir, relPath)
		if err != nil {
			jsonErr(w, err.Error(), 403)
			return
		}
		info, err := os.Stat(target)
		if err != nil {
			jsonErr(w, err.Error(), 404)
			return
		}
		if info.IsDir() {
			jsonErr(w, "refusing to delete directory", 400)
			return
		}
		if err := os.Remove(target); err != nil {
			jsonErr(w, err.Error(), 500)
			return
		}
		jsonOK(w, map[string]interface{}{"deleted": true, "path": relPath})
	}))

	addr := net.JoinHostPort(cfg.ListenAddr, strconv.Itoa(cfg.ListenPort))

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		protocol := "http"
		if cfg.TLS != nil && cfg.TLS.Cert != "" && cfg.TLS.Key != "" {
			protocol = "https"
			server.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
			log.Printf("Zoraxy agent %s listening on %s://%s", agentVersion, protocol, addr)
			if err := server.ListenAndServeTLS(cfg.TLS.Cert, cfg.TLS.Key); err != http.ErrServerClosed {
				log.Fatalf("Server error: %v", err)
			}
		} else {
			log.Printf("Zoraxy agent %s listening on %s://%s", agentVersion, protocol, addr)
			if err := server.ListenAndServe(); err != http.ErrServerClosed {
				log.Fatalf("Server error: %v", err)
			}
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down zoraxy-agent...")
	server.Close()
}
