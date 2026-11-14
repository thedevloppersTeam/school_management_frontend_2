import { describe, expect, it } from "vitest"
import { passwordPolicyError } from "../password-policy"

describe("passwordPolicyError", () => {
  it.each(["Motdepasse-2026", "abcdefg1", "é".repeat(7) + "1", "a1".repeat(36)])(
    "accepte « %s »",
    (password) => {
      expect(passwordPolicyError(password)).toBeNull()
    },
  )

  it.each([
    ["", "8 caractères"],
    ["abc1", "8 caractères"],
    ["abcdefgh", "une lettre et au moins un chiffre"],
    ["12345678", "une lettre et au moins un chiffre"],
    ["a1".repeat(36) + "b", "72 octets"],
    ["é".repeat(36) + "1", "72 octets"],
  ])("refuse « %s » (%s)", (password, reason) => {
    expect(passwordPolicyError(password)).toContain(reason)
  })
})
