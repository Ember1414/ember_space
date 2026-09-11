import type { UserRecord } from './lib/db';

declare global {
  namespace Cloudflare {
    interface Env {
      INITIAL_SETUP_KEY?: string;
      SESSION_SECRET?: string;
      CF_PAGES?: string;
    }
  }

  namespace App {
    interface Locals {
      user?: UserRecord;
      csrfToken?: string;
    }
  }
}

export {};
