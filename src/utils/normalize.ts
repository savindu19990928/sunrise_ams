/**
 * Bridges the backend's field names (API documentation v3) and the field names
 * the UI reads. Responses gain the UI aliases; request bodies gain the API
 * names. Aliases are only filled when missing, so either shape is safe.
 */

type Json = Record<string, unknown>;
type Alias = [uiKey: string, apiKey: string];

const RESOURCE_ALIASES: Record<string, Alias[]> = {
  rooms: [['base_deposit', 'base_deposit_amount']],
  leases: [
  ['is_active', 'active'],
  ['deposit_paid', 'initial_deposit']],

  bills: [
  ['rent', 'rent_fee'],
  ['electricity', 'electricity_cost'],
  ['water', 'water_cost'],
  ['deposit_deduction', 'deposit_deducted'],
  ['remaining_deposit', 'deposit_remaining'],
  ['total_due', 'total_amount_due']],

  payments: [['amount', 'amount_paid']],
  repairs: [
  ['repair_cost', 'cost'],
  ['repair_description', 'description'],
  ['repair_date', 'date_logged']]

};

function resourceOf(path: string): string | null {
  const match = /^\/api\/([a-z-]+)\//.exec(path);
  return match && RESOURCE_ALIASES[match[1]] ? match[1] : null;
}

function isPlainObject(value: unknown): value is Json {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRecord(resource: string, record: Json): Json {
  const out: Json = { ...record };
  for (const [uiKey, apiKey] of RESOURCE_ALIASES[resource]) {
    if (out[uiKey] === undefined && out[apiKey] !== undefined) out[uiKey] = out[apiKey];
  }

  if (resource === 'bills') {
    // Bill detail embeds the full customer / room objects.
    if (isPlainObject(out.customer)) {
      const customer = out.customer;
      out.customer_name ??= `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();
    }
    if (isPlainObject(out.room)) out.room_number ??= out.room.room_number;
    if (out.amount_paid === undefined && typeof out.is_paid === 'boolean') {
      out.amount_paid = out.is_paid ? out.total_due ?? 0 : 0;
    }
    if (out.status === undefined && out.is_paid === true) out.status = 'paid';
  }

  return out;
}

export function normalizeResponse<T>(path: string, payload: T): T {
  const resource = resourceOf(path);
  if (!resource || !payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => isPlainObject(item) ? normalizeRecord(resource, item) : item) as T;
  }
  const record = payload as unknown as Json;
  if (Array.isArray(record.results)) {
    return {
      ...record,
      results: record.results.map((item) => isPlainObject(item) ? normalizeRecord(resource, item) : item)
    } as T;
  }
  return normalizeRecord(resource, record) as T;
}

export function normalizeRequestBody(path: string, body: unknown): unknown {
  const resource = resourceOf(path);
  if (!resource || !isPlainObject(body)) return body;
  const out: Json = { ...body };
  for (const [uiKey, apiKey] of RESOURCE_ALIASES[resource]) {
    if (out[apiKey] === undefined && out[uiKey] !== undefined) out[apiKey] = out[uiKey];
  }
  return out;
}