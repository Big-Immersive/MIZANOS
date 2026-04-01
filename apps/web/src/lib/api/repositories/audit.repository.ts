import type { Audit } from "@/lib/types";
import { BaseRepository, type PaginatedResponse, type QueryParams } from "./base.repository";

export class AuditRepository extends BaseRepository<Audit> {
  protected readonly basePath = "/audits";

  async getByProduct(productId: string, params?: QueryParams): Promise<PaginatedResponse<Audit>> {
    return this.getAll({ ...params, product_id: productId });
  }

  async runAudit(productId: string): Promise<Audit> {
    const response = await this.client.post<Audit>(`${this.basePath}/run`, {
      product_id: productId,
    });
    return response.data;
  }

  async deleteAudit(auditId: string): Promise<void> {
    await this.client.delete(`${this.basePath}/${auditId}`);
  }

  async getLatest(productId: string): Promise<Audit | null> {
    const result = await this.getAll({
      product_id: productId,
      sortBy: "run_at",
      sortOrder: "desc",
      pageSize: 1,
    });
    return result.data[0] ?? null;
  }
}

export const auditRepository = new AuditRepository();
