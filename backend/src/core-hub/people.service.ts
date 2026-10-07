import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoreHubCallError, coreHubFailure, getFromCoreHub } from './core-hub-http';

export type CoreHubStudentOption = {
  personCode: string;
  fullNameTh: string;
  fullNameEn: string | null;
  coreUserId: string | null;
  entryYear: number | null;
};

export type CoreHubStudentPage = {
  items: CoreHubStudentOption[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

/**
 * Personal data is always fetched on demand with the requesting user's token.
 * Never cache or persist names, email, or directory results.
 */
@Injectable()
export class PeopleService {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('coreHub.url', 'http://localhost:3000').replace(/\/+$/, '');
  }

  private get requestTimeoutMs(): number {
    return this.config.get<number>('coreHub.dataRequestTimeoutMs', 5_000);
  }

  async listActiveEntryYears(token: string): Promise<number[]> {
    const years = new Set<number>();
    let page = 1;
    let totalPages = 1;

    do {
      const url = new URL(this.baseUrl + '/api/v1/people');
      url.searchParams.set('personType', 'STUDENT');
      url.searchParams.set('status', 'ACTIVE');
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', '100');

      let body: unknown;
      try {
        body = await getFromCoreHub(url.toString(), token, this.requestTimeoutMs);
      } catch (error) {
        throw coreHubFailure(error);
      }

      const response = body as {
        success?: unknown;
        data?: unknown;
        meta?: { totalPages?: unknown };
      } | null;
      if (response?.success !== true || !Array.isArray(response.data) || typeof response.meta?.totalPages !== 'number') {
        throw coreHubFailure(new Error('GET /people answered with an invalid entry-year response'));
      }

      for (const value of response.data) {
        if (!value || typeof value !== 'object') continue;
        const entryYear = (value as Record<string, unknown>).entryYear;
        if (typeof entryYear === 'number') years.add(entryYear);
      }
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return [...years].sort((a, b) => b - a);
  }

  async myPersonCode(token: string): Promise<string | null> {
    let body: unknown;
    try {
      body = await getFromCoreHub(`${this.baseUrl}/api/v1/people/me`, token, this.requestTimeoutMs);
    } catch (error) {
      if (error instanceof CoreHubCallError && error.status === 403) return null;
      throw coreHubFailure(error);
    }

    const { success, data } = (body ?? {}) as { success?: unknown; data?: unknown };
    if (success === true && data === null) return null;
    const personCode = (data as { personCode?: unknown } | undefined)?.personCode;
    if (success !== true || typeof personCode !== 'string' || personCode.length === 0) {
      throw coreHubFailure(new Error('GET /people/me answered without a personCode'));
    }
    return personCode;
  }

  /**
   * Current active student directory filtered directly by Core Hub's entryYear
   * (the student's first-admission academic year). This deliberately does not
   * require department scope.
   */
  async listActiveStudents(token: string, query: { q?: string; page?: number; entryYear?: number }): Promise<CoreHubStudentPage> {
    const page = Number.isInteger(query.page) && (query.page ?? 0) > 0 ? query.page! : 1;
    const url = new URL(`${this.baseUrl}/api/v1/people`);
    url.searchParams.set('personType', 'STUDENT');
    url.searchParams.set('status', 'ACTIVE');
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', '100');
    if (Number.isInteger(query.entryYear)) url.searchParams.set('entryYear', String(query.entryYear));
    const q = query.q?.trim();
    if (q) url.searchParams.set('q', q.slice(0, 100));

    let body: unknown;
    try {
      body = await getFromCoreHub(url.toString(), token, this.requestTimeoutMs);
    } catch (error) {
      throw coreHubFailure(error);
    }
    const response = body as {
      success?: unknown;
      data?: unknown;
      meta?: { total?: unknown; page?: unknown; limit?: unknown; totalPages?: unknown };
    } | null;
    const meta = response?.meta;
    if (
      response?.success !== true ||
      !Array.isArray(response.data) ||
      typeof meta?.total !== 'number' ||
      typeof meta.page !== 'number' ||
      typeof meta.limit !== 'number' ||
      typeof meta.totalPages !== 'number'
    ) {
      throw coreHubFailure(new Error('GET /people answered with an invalid directory response'));
    }

    const items = response.data.flatMap((value): CoreHubStudentOption[] => {
      if (!value || typeof value !== 'object') return [];
      const person = value as Record<string, unknown>;
      if (
        person.personType !== 'STUDENT' ||
        person.status !== 'ACTIVE' ||
        typeof person.personCode !== 'string' ||
        typeof person.fullNameTh !== 'string'
      ) {
        return [];
      }
      return [{
        personCode: person.personCode,
        fullNameTh: person.fullNameTh,
        fullNameEn: typeof person.fullNameEn === 'string' ? person.fullNameEn : null,
        coreUserId: typeof person.coreUserId === 'string' ? person.coreUserId : null,
        entryYear: typeof person.entryYear === 'number' ? person.entryYear : null,
      }];
    });

    return {
      items,
      meta: {
        total: meta.total,
        page: meta.page,
        limit: meta.limit,
        totalPages: meta.totalPages,
      },
    };
  }
}
