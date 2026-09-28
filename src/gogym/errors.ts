export class GoGymHttpError extends Error {
  readonly path: string;
  readonly status: number;
  readonly responseBody: string;

  constructor(path: string, status: number, responseBody: string) {
    super(`GoGym ${path} HTTP ${status}`);
    this.name = "GoGymHttpError";
    this.path = path;
    this.status = status;
    this.responseBody = responseBody;
  }
}
