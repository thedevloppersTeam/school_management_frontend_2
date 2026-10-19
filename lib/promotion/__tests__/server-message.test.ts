/**
 * Message affiché par l'écran de promotion quand le serveur refuse un appel.
 * Passe par clientFetch (fetch simulé) pour reproduire la chaîne réelle :
 * réponse HTTP -> ApiError -> serverMessage.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clientFetch } from '@/lib/client-fetch'
import { toMessage } from '@/lib/errors'
import { serverMessage } from '../screen'

const CONTEXT = 'lors du chargement de la délibération'
const RP08 = "Délibération impossible : l'étape « Étape 1 & 2 » n'est pas terminée (fin le 2027-01-30)."

async function refusal(status: number, body: string): Promise<unknown> {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })))
  try {
    await clientFetch('/api/promotions/preview?classSessionId=s-1')
  } catch (err) {
    return err
  }
  throw new Error('clientFetch aurait dû rejeter')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('écran de promotion — message de refus du serveur', () => {
  it('409 avec un message dans le corps : texte du serveur tel quel', async () => {
    const err = await refusal(409, JSON.stringify({ message: RP08 }))
    expect(serverMessage(err, CONTEXT)).toBe(RP08)
  })

  it('409 sans corps : texte générique actuel', async () => {
    const err = await refusal(409, '')
    expect(serverMessage(err, CONTEXT)).toBe(toMessage(err, CONTEXT))
    expect(serverMessage(err, CONTEXT)).toBe(
      'Ce changement entre en conflit avec une donnée existante lors du chargement de la délibération.'
    )
  })
})
