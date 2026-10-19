import { supabaseClient } from './supabaseClient'

export interface SupabaseProgressRow {
  record_id: string
  child_id: string
  payload: Record<string, unknown>
  updated_at: string
}

export interface SupabaseTombstone {
  entity: string
  record_id: string
  changed_at: string
}

function client() {
  if (!supabaseClient) throw new Error('Molnsynk är inte konfigurerad ännu.')
  return supabaseClient
}

export const SupabaseProgressRepository = {
  async list(remoteTable: string): Promise<SupabaseProgressRow[]> {
    const rows: SupabaseProgressRow[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client().from(remoteTable).select('record_id,child_id,payload,updated_at')
        .order('record_id').range(offset, offset + 499)
      if (error) throw error
      rows.push(...(data ?? []) as unknown as SupabaseProgressRow[])
      if ((data?.length ?? 0) < 500) return rows
    }
  },

  async listTombstones(remoteTable: string): Promise<SupabaseTombstone[]> {
    const rows: SupabaseTombstone[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client().from('sync_tombstones').select('entity,record_id,changed_at')
        .eq('entity', remoteTable).order('record_id').range(offset, offset + 499)
      if (error) throw error
      rows.push(...(data ?? []) as SupabaseTombstone[])
      if ((data?.length ?? 0) < 500) return rows
    }
  },

  async getUpdatedAt(remoteTable: string, recordId: string): Promise<string | undefined> {
    const { data, error } = await client().from(remoteTable).select('updated_at').eq('record_id', recordId).maybeSingle()
    if (error) throw error
    return (data as { updated_at?: string } | null)?.updated_at
  },

  async upsert(remoteTable: string, ownerId: string, childId: string, recordId: string, payload: Record<string, unknown>, updatedAt: string): Promise<void> {
    const { error } = await client().from(remoteTable).upsert({
      owner_id: ownerId,
      child_id: childId,
      record_id: recordId,
      payload,
      updated_at: updatedAt,
    }, { onConflict: 'owner_id,record_id' })
    if (error) throw error
  },

  async delete(remoteTable: string, ownerId: string, recordId: string): Promise<void> {
    const { error } = await client().from(remoteTable).delete().eq('owner_id', ownerId).eq('record_id', recordId)
    if (error) throw error
  },

  async upsertTombstone(ownerId: string, entity: string, recordId: string, changedAt: string): Promise<void> {
    const { error } = await client().from('sync_tombstones').upsert({
      owner_id: ownerId,
      entity,
      record_id: recordId,
      changed_at: changedAt,
    }, { onConflict: 'owner_id,entity,record_id' })
    if (error) throw error
  },

  async deleteTombstone(ownerId: string, entity: string, recordId: string): Promise<void> {
    const { error } = await client().from('sync_tombstones').delete()
      .eq('owner_id', ownerId).eq('entity', entity).eq('record_id', recordId)
    if (error) throw error
  },
}
