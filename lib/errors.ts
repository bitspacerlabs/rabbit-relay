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