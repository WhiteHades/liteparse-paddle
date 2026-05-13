import { Logger, type ILogObj } from "tslog";

export class PrefixedLogger {
  private logger: Logger<ILogObj>;
  prefix: string;

  constructor(prefix: string) {
    this.logger = new Logger<ILogObj>({ minLevel: 2 }); // debug
    this.prefix = prefix;
  }

  info(message: string, ...args: unknown[]) {
    this.logger.info(`${this.prefix} ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    this.logger.debug(`${this.prefix} ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.logger.error(`${this.prefix} ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.logger.warn(`${this.prefix} ${message}`, ...args);
  }

  silly(message: string, ...args: unknown[]) {
    this.logger.silly(`${this.prefix} ${message}`, ...args);
  }

  fatal(message: string, ...args: unknown[]) {
    this.logger.fatal(`${this.prefix} ${message}`, ...args);
  }

  trace(message: string, ...args: unknown[]) {
    this.logger.trace(`${this.prefix} ${message}`, ...args);
  }
}
