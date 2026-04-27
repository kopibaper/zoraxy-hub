export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      id ? `${entity} '${id}' not found` : `${entity} not found`,
      404,
      "NOT_FOUND"
    );
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class NodeConnectionError extends AppError {
  constructor(
    public nodeId: string,
    public nodeName: string,
    originalError: string
  ) {
    super(
      `Failed to connect to node '${nodeName}': ${originalError}`,
      502,
      "NODE_CONNECTION_ERROR"
    );
    this.name = "NodeConnectionError";
  }
}

export class ZoraxyApiError extends AppError {
  constructor(
    public endpoint: string,
    public zoraxyMessage: string,
    statusCode: number = 502
  ) {
    super(
      `Zoraxy API error at ${endpoint}: ${zoraxyMessage}`,
      statusCode,
      "ZORAXY_API_ERROR"
    );
    this.name = "ZoraxyApiError";
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  console.error("Unhandled error:", error);
  return Response.json(
    {
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}
