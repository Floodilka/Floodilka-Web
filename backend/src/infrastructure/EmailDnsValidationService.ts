import {Resolver} from 'node:dns/promises';
import {Config} from '~/Config';
import {Logger} from '~/Logger';

interface DomainValidationCacheEntry {
	valid: boolean;
	expiresAtMs: number;
}

interface IDnsResolver {
	resolveMx(domain: string): Promise<Array<{exchange: string; priority: number}>>;
	resolve4(domain: string): Promise<Array<string>>;
	resolve6(domain: string): Promise<Array<string>>;
}

interface EmailDnsValidationServiceOptions {
	resolver?: IDnsResolver;
	positiveTtlMs?: number;
	negativeTtlMs?: number;
}

type DnsResolutionResult = 'valid' | 'invalid' | 'fallback' | 'transient_error';

const DOMAIN_NOT_FOUND_CODES = new Set(['ENOTFOUND', 'ENONAME', 'EAI_NONAME', 'NXDOMAIN']);
const DOMAIN_NO_RECORD_CODES = new Set(['ENODATA', 'ENOENT', 'NODATA']);

const POSITIVE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const NEGATIVE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class EmailDnsValidationService {
	private readonly resolver: IDnsResolver;
	private readonly positiveTtlMs: number;
	private readonly negativeTtlMs: number;
	private readonly domainCache = new Map<string, DomainValidationCacheEntry>();

	constructor(options: EmailDnsValidationServiceOptions = {}) {
		this.resolver = options.resolver ?? new Resolver();
		this.positiveTtlMs = options.positiveTtlMs ?? POSITIVE_TTL_MS;
		this.negativeTtlMs = options.negativeTtlMs ?? NEGATIVE_TTL_MS;
	}

	async hasValidDnsRecords(email: string): Promise<boolean> {
		if (Config.dev.testModeEnabled) {
			return true;
		}

		const domain = this.extractDomain(email);
		if (!domain) {
			return false;
		}

		const cached = this.getCachedDomainResult(domain);
		if (cached !== null) {
			return cached;
		}

		const isValid = await this.resolveDomain(domain);
		this.setCachedDomainResult(domain, isValid);
		return isValid;
	}

	private extractDomain(email: string): string | null {
		const atIndex = email.lastIndexOf('@');
		if (atIndex <= 0 || atIndex === email.length - 1) {
			return null;
		}
		return email.slice(atIndex + 1).toLowerCase();
	}

	private getCachedDomainResult(domain: string): boolean | null {
		const cached = this.domainCache.get(domain);
		if (!cached) {
			return null;
		}

		if (Date.now() >= cached.expiresAtMs) {
			this.domainCache.delete(domain);
			return null;
		}

		return cached.valid;
	}

	private setCachedDomainResult(domain: string, isValid: boolean): void {
		const ttlMs = isValid ? this.positiveTtlMs : this.negativeTtlMs;
		this.domainCache.set(domain, {
			valid: isValid,
			expiresAtMs: Date.now() + ttlMs,
		});
	}

	private async resolveDomain(domain: string): Promise<boolean> {
		const mxResult = await this.resolveMx(domain);
		if (mxResult === 'valid') {
			return true;
		}
		if (mxResult === 'invalid') {
			return false;
		}
		if (mxResult === 'transient_error') {
			return true;
		}

		const addressResult = await this.resolveAddressRecords(domain);
		if (addressResult === 'valid') {
			return true;
		}
		if (addressResult === 'invalid') {
			return false;
		}
		return true;
	}

	private async resolveMx(domain: string): Promise<DnsResolutionResult> {
		try {
			const records = await this.resolver.resolveMx(domain);
			if (records.length > 0) {
				return 'valid';
			}
			return 'fallback';
		} catch (error) {
			return this.classifyResolverError(error, domain, true);
		}
	}

	private async resolveAddressRecords(domain: string): Promise<DnsResolutionResult> {
		const [ipv4Result, ipv6Result] = await Promise.allSettled([
			this.resolver.resolve4(domain),
			this.resolver.resolve6(domain),
		]);

		if (ipv4Result.status === 'fulfilled' && ipv4Result.value.length > 0) {
			return 'valid';
		}
		if (ipv6Result.status === 'fulfilled' && ipv6Result.value.length > 0) {
			return 'valid';
		}

		const ipv4Classification =
			ipv4Result.status === 'rejected'
				? this.classifyResolverError(ipv4Result.reason, domain, false)
				: 'invalid';
		const ipv6Classification =
			ipv6Result.status === 'rejected'
				? this.classifyResolverError(ipv6Result.reason, domain, false)
				: 'invalid';

		if (ipv4Classification === 'transient_error' || ipv6Classification === 'transient_error') {
			return 'transient_error';
		}

		return 'invalid';
	}

	private classifyResolverError(
		error: unknown,
		domain: string,
		allowFallbackForNoRecords: boolean,
	): DnsResolutionResult {
		const code = this.extractErrorCode(error);
		if (code && DOMAIN_NOT_FOUND_CODES.has(code)) {
			return 'invalid';
		}
		if (code && DOMAIN_NO_RECORD_CODES.has(code)) {
			return allowFallbackForNoRecords ? 'fallback' : 'invalid';
		}

		Logger.warn({domain, code, error}, 'Email DNS lookup failed with a transient error, allowing request');
		return 'transient_error';
	}

	private extractErrorCode(error: unknown): string | null {
		if (!error || typeof error !== 'object' || !('code' in error)) {
			return null;
		}
		const code = (error as {code?: unknown}).code;
		return typeof code === 'string' ? code : null;
	}
}
