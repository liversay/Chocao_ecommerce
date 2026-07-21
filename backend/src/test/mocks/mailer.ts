import { mock } from "bun:test";

export const sendEmailMock = mock(async () => {});

export function resetMailerMock() {
  sendEmailMock.mockClear();
}

mock.module("../../lib/mailer", () => ({ sendEmail: sendEmailMock }));
