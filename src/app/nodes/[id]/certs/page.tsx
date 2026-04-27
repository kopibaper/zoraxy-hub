"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Upload,
  Search,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/layout/app-shell";
import {
  useCerts,
  useDeleteCert,
  useObtainACME,
  useUploadCert,
  useAutoRenewDomains,
} from "@/hooks/use-certs";
import { useNode } from "@/hooks/use-nodes";

function getCertStatus(remainingDays: number) {
  if (remainingDays <= 0) return { label: "Expired", variant: "danger" as const, icon: AlertTriangle };
  if (remainingDays <= 30) return { label: "Expiring Soon", variant: "warning" as const, icon: Clock };
  return { label: "Valid", variant: "success" as const, icon: CheckCircle2 };
}

export default function CertsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: node } = useNode(id);
  const { data: certs = [], isLoading } = useCerts(id);
  const {
    data: autoRenewDomains = [],
    isLoading: isAutoRenewLoading,
    refetch: refetchAutoRenew,
  } = useAutoRenewDomains(id);
  const deleteCert = useDeleteCert(id);
  const obtainACME = useObtainACME(id);
  const uploadCert = useUploadCert(id);

  const [showAcmeDialog, setShowAcmeDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [acmeForm, setAcmeForm] = useState({ domains: "", email: "" });
  const [uploadForm, setUploadForm] = useState({
    domain: "",
    certPem: "",
    keyPem: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const autoRenewSet = useMemo(
    () => new Set(autoRenewDomains.map((domain) => domain.toLowerCase())),
    [autoRenewDomains]
  );

  const filteredCerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return certs;
    return certs.filter((cert) => cert.Domain.toLowerCase().includes(query));
  }, [certs, searchQuery]);

  const certStats = useMemo(() => {
    const total = certs.length;
    const valid = certs.filter((cert) => cert.RemainingDays > 30).length;
    const expiringSoon = certs.filter(
      (cert) => cert.RemainingDays > 0 && cert.RemainingDays <= 30
    ).length;
    const expired = certs.filter((cert) => cert.RemainingDays <= 0).length;
    return { total, valid, expiringSoon, expired };
  }, [certs]);

  const handleDelete = async (domain: string) => {
    if (!confirm(`Delete certificate for "${domain}"?`)) return;
    await deleteCert.mutateAsync(domain);
  };

  const handleAcme = async () => {
    const domains = acmeForm.domains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    await obtainACME.mutateAsync({ domains, email: acmeForm.email });
    setShowAcmeDialog(false);
    setAcmeForm({ domains: "", email: "" });
  };

  const handleUpload = async () => {
    await uploadCert.mutateAsync({
      domain: uploadForm.domain.trim(),
      certPem: uploadForm.certPem,
      keyPem: uploadForm.keyPem,
    });
    setShowUploadDialog(false);
    setUploadForm({ domain: "", certPem: "", keyPem: "" });
  };

  const toggleExpanded = (domain: string) => {
    setExpandedDomain((current) => (current === domain ? null : domain));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/nodes/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Certificates
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400">
                {node?.name ?? "Loading..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
              <Upload className="h-4 w-4" />
              Upload Certificate
            </Button>
            <Button onClick={() => setShowAcmeDialog(true)}>
              <ShieldCheck className="h-4 w-4" />
              Obtain via ACME
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Certificates</p>
              <p className="mt-1 text-2xl font-bold">{certStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Valid</p>
              <p className="mt-1 text-2xl font-bold">{certStats.valid}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-amber-600 dark:text-amber-400">Expiring Soon (&lt; 30 days)</p>
              <p className="mt-1 text-2xl font-bold">{certStats.expiringSoon}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-red-600 dark:text-red-400">Expired</p>
              <p className="mt-1 text-2xl font-bold">{certStats.expired}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">ACME Auto-Renew Configuration</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchAutoRenew()}
              title="Refresh auto-renew domains"
            >
              <RefreshCw
                className={`h-4 w-4 ${isAutoRenewLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </CardHeader>
          <CardContent>
            {isAutoRenewLoading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading auto-renew domains...
              </p>
            ) : autoRenewDomains.length > 0 ? (
              <div className="space-y-2">
                {autoRenewDomains.map((domain) => (
                  <div
                    key={domain}
                    className="rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm dark:border-zinc-800"
                  >
                    {domain}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No domains are currently configured for ACME auto-renew.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            className="pl-9"
            placeholder="Search certificates by domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : filteredCerts.length > 0 ? (
          <div className="space-y-3">
            {filteredCerts.map((cert) => {
              const status = getCertStatus(cert.RemainingDays);
              const StatusIcon = status.icon;
              const isExpanded = expandedDomain === cert.Domain;
              const isAutoRenewEnabled = autoRenewSet.has(cert.Domain.toLowerCase());

              return (
                <Card key={cert.Domain}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(cert.Domain)}
                        className="flex flex-1 items-center gap-4 rounded-lg text-left"
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            status.variant === "success"
                              ? "bg-emerald-100 dark:bg-emerald-900/30"
                              : status.variant === "warning"
                              ? "bg-amber-100 dark:bg-amber-900/30"
                              : "bg-red-100 dark:bg-red-900/30"
                          }`}
                        >
                          <StatusIcon
                            className={`h-5 w-5 ${
                              status.variant === "success"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : status.variant === "warning"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm font-medium">{cert.Domain}</p>
                            <Badge variant={status.variant} className="text-[10px]">
                              {status.label}
                            </Badge>
                            {cert.UseDNS && (
                              <Badge variant="secondary" className="text-[10px]">
                                DNS
                              </Badge>
                            )}
                            {isAutoRenewEnabled && (
                              <Badge variant="secondary" className="text-[10px]">
                                Auto-Renew
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>
                              Expires:{" "}
                              {cert.ExpireDate
                                ? new Date(cert.ExpireDate).toLocaleDateString()
                                : "Unknown"}
                            </span>
                            <span>
                              {cert.RemainingDays > 0
                                ? `${cert.RemainingDays} days remaining`
                                : "Expired"}
                            </span>
                          </div>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(cert.Domain);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Full Domain:</span>{" "}
                            <span className="font-mono">{cert.Domain}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Last Modified:</span>{" "}
                            <span>
                              {cert.LastModifiedDate
                                ? new Date(cert.LastModifiedDate).toLocaleString()
                                : "Unknown"}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">DNS Challenge:</span>{" "}
                            <span>{cert.UseDNS ? "Yes" : "No"}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 dark:text-zinc-400">Auto-Renew:</span>{" "}
                            <span>{isAutoRenewEnabled ? "Enabled" : "Not Enabled"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Lock className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
              <p className="mt-4 text-lg font-medium">No certificates</p>
               <p className="text-sm text-zinc-500 dark:text-zinc-400">
                 Obtain certificates via ACME or upload manually
               </p>
               <div className="mt-4 flex items-center gap-2">
                 <Button
                   variant="outline"
                   onClick={() => setShowUploadDialog(true)}
                 >
                   <Upload className="h-4 w-4" />
                   Upload Certificate
                 </Button>
                 <Button onClick={() => setShowAcmeDialog(true)}>
                   <ShieldCheck className="h-4 w-4" />
                   Obtain via ACME
                 </Button>
               </div>
             </CardContent>
           </Card>
        )}

        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Certificate</DialogTitle>
              <DialogDescription>
                Upload an existing certificate and private key in PEM format.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Domain</label>
                <Input
                  className="mt-1"
                  placeholder="example.com"
                  value={uploadForm.domain}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, domain: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Certificate PEM</label>
                <textarea
                  className="mt-1 min-h-[140px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-800 dark:bg-zinc-950"
                  placeholder={`-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----`}
                  value={uploadForm.certPem}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, certPem: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Private Key PEM</label>
                <textarea
                  className="mt-1 min-h-[140px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-800 dark:bg-zinc-950"
                  placeholder={`-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----`}
                  value={uploadForm.keyPem}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, keyPem: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowUploadDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={
                  !uploadForm.domain.trim() ||
                  !uploadForm.certPem.trim() ||
                  !uploadForm.keyPem.trim() ||
                  uploadCert.isPending
                }
              >
                {uploadCert.isPending ? "Uploading..." : "Upload Certificate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAcmeDialog} onOpenChange={setShowAcmeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Obtain Certificate via ACME</DialogTitle>
              <DialogDescription>
                Automatically obtain a TLS certificate using Let&apos;s Encrypt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  Domains (comma-separated)
                </label>
                <Input
                  className="mt-1"
                  placeholder="example.com, www.example.com"
                  value={acmeForm.domains}
                  onChange={(e) =>
                    setAcmeForm({ ...acmeForm, domains: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  className="mt-1"
                  type="email"
                  placeholder="admin@example.com"
                  value={acmeForm.email}
                  onChange={(e) =>
                    setAcmeForm({ ...acmeForm, email: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAcmeDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAcme}
                disabled={
                  !acmeForm.domains || !acmeForm.email || obtainACME.isPending
                }
              >
                {obtainACME.isPending ? "Obtaining..." : "Obtain Certificate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
