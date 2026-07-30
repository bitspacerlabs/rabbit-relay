export class MessageTooLargeError extends Error {
  public readonly eventName: string;
  public readonly sizeBytes: number;
  public readonly maxBytes: number;

  constructor(params: {
    eventName: string;
    sizeBytes: number;
    maxBytes: number;
  }) {
    super(
      `MessageTooLargeError: event '${params.eventName}' is ${params.sizeBytes} bytes, ` +
        `max allowed is ${params.maxBytes} bytes. ` +
        `Store large payloads externally and publish a reference instead.`
    );

    this.name = "MessageTooLargeError";
    this.eventName = params.eventName;
    this.sizeBytes = params.sizeBytes;
    this.maxBytes = params.maxBytes;
  }
}

export class SchemaValidationError extends Error {
  public readonly eventName: string;
  public readonly eventVersion: string;
  public readonly eventId: string;
  public readonly originalError: unknown;

  constructor(params: {
    eventName: string;
    eventVersion: string;
    eventId: string;
    originalError: unknown;
  }) {
    const message =
      params.originalError instanceof Error
        ? params.originalError.message
        : String(params.originalError);

    super(
      `SchemaValidationError: event '${params.eventName}' v${params.eventVersion} ` +
        `(id: ${params.eventId}) failed validation: ${message}`
    );

    this.name = "SchemaValidationError";
    this.eventName = params.eventName;
    this.eventVersion = params.eventVersion;
    this.eventId = params.eventId;
    this.originalError = params.originalError;
  }
}