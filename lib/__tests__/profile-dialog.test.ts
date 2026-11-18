/**
 * Dialogue « Mon compte » (components/school/profile-dialog.tsx), lot ID-T-F-1,
 * D-TF1-3 : le corps envoyé à POST /api/users/update-my-profile.
 *
 * Le serveur n'admet qu'une liste FERMÉE de champs (firstname, lastname,
 * profilePhoto) et répond 400 IDENTITE_PROFIL_ENTREE_INVALIDE à tout autre champ
 * (api.md du serveur). Le dialogue reçoit la réponse de /me (id, username, type,
 * isActive, roles, permissions) : il ne doit envoyer que le prénom et le nom.
 *
 * Pas de DOM dans ces tests (environnement node) : le composant est appelé comme
 * une fonction, `useState` rendu inerte, et le gestionnaire du bouton
 * « Enregistrer » est lu dans l'arbre JSX renvoyé, puis appelé. Valeurs fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactNode } from 'react'

vi.mock('react', async (importOriginal) => {
  const reel = await importOriginal<typeof import('react')>()
  return {
    ...reel,
    useState: <T,>(initial: T | (() => T)) => [
      typeof initial === 'function' ? (initial as () => T)() : initial,
      () => undefined,
    ],
  }
})

const toast = vi.fn()
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }))

const { ProfileDialog } = await import('@/components/school/profile-dialog')

/** Réponse de /me d'un compte fictif, telle que la coque la passe au dialogue. */
const moi = {
  id: '00000000-0000-4000-8000-000000000001',
  firstname: 'Alpha',
  lastname: 'Essai',
  username: 'essai.fictif',
  type: 'TEACHER',
  isActive: true,
  roles: ['TEACHER'],
  permissions: [{ permission: 'identite.profil.modifier', portee: 'tout' }],
} as const

type Props = { onClick?: () => unknown; children?: ReactNode }

const texte = (n: ReactNode): string => {
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(texte).join('')
  if (isValidElement<Props>(n)) return texte(n.props.children)
  return ''
}

/** Le gestionnaire du premier élément cliquable dont le texte contient `libelle`. */
function gestionnaire(n: ReactNode, libelle: string): (() => unknown) | null {
  if (Array.isArray(n)) {
    for (const enfant of n) {
      const g = gestionnaire(enfant, libelle)
      if (g) return g
    }
    return null
  }
  if (!isValidElement<Props>(n)) return null
  if (typeof n.props.onClick === 'function' && texte(n.props.children).includes(libelle)) return n.props.onClick
  return gestionnaire(n.props.children, libelle)
}

let envoye: { url: string; init: RequestInit } | null
let statut: number

beforeEach(() => {
  envoye = null
  statut = 200
  toast.mockClear()
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    envoye = { url, init }
    return new Response(JSON.stringify({ message: 'ok' }), { status: statut })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function enregistrer(onProfileUpdated = vi.fn()) {
  const arbre = ProfileDialog({ open: true, onOpenChange: () => undefined, user: moi, onProfileUpdated })
  const surClic = gestionnaire(arbre, 'Enregistrer')
  expect(surClic).not.toBeNull()
  await surClic!()
  return onProfileUpdated
}

describe('ProfileDialog — corps de update-my-profile (D-TF1-3)', () => {
  it('envoie le prénom et le nom, et RIEN d’autre', async () => {
    await enregistrer()
    expect(envoye?.url).toBe('/api/users/update-my-profile')
    expect(envoye?.init.method).toBe('POST')
    expect(JSON.parse(String(envoye?.init.body))).toEqual({ firstname: 'Alpha', lastname: 'Essai' })
  })

  it('aucun champ de /me hors liste fermée (id, username, type, isActive, roles, permissions)', async () => {
    await enregistrer()
    const corps = JSON.parse(String(envoye?.init.body)) as Record<string, unknown>
    for (const champ of ['id', 'username', 'type', 'isActive', 'roles', 'permissions']) {
      expect(corps).not.toHaveProperty(champ)
    }
  })

  it('succès : la coque reçoit le compte mis à jour, champs de /me conservés', async () => {
    const onProfileUpdated = await enregistrer()
    expect(onProfileUpdated).toHaveBeenCalledWith({ ...moi, firstname: 'Alpha', lastname: 'Essai' })
    expect(toast).toHaveBeenCalledWith({ title: 'Profil mis à jour' })
  })

  it('refus du serveur : la coque n’est pas mise à jour, un message d’erreur s’affiche', async () => {
    statut = 400
    const onProfileUpdated = await enregistrer()
    expect(onProfileUpdated).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur', variant: 'destructive' }))
  })
})
