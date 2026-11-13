/** Expected business-rule failure. `code` is a translation key in "actionErrors". */
export class DomainError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "DomainError";
  }
}

export interface DenialInfo {
  actorId: string;
  actorRole: "SUPER_ADMIN" | "USER" | "VENDOR";
  action: string;
  entityType: string;
  entityId: string;
  branchId?: string | null;
}

/**
 * Authorization failure. Carries what must be audited; `withDenialAudit`
 * records it AFTER the surrounding transaction rolls back, so the evidence
 * of an access violation is never lost.
 */
export class AccessDenied extends DomainError {
  constructor(public denial: DenialInfo) {
    super("notAllowed");
    this.name = "AccessDenied";
  }
}
