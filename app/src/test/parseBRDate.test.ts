import { describe, it, expect } from 'vitest'
import { parseBRDate } from '../types/insights'

describe('parseBRDate', () => {
  it('should parse valid Brazilian date format', () => {
    const result = parseBRDate('19/04/2026 10:30:00')
    expect(result).toBeInstanceOf(Date)
    expect(result?.getFullYear()).toBe(2026)
    expect(result?.getMonth()).toBe(3) // April (0-indexed)
    expect(result?.getDate()).toBe(19)
  })

  it('should handle date only without time', () => {
    const result = parseBRDate('19/04/2026')
    expect(result).toBeInstanceOf(Date)
    expect(result?.getFullYear()).toBe(2026)
    expect(result?.getMonth()).toBe(3)
    expect(result?.getDate()).toBe(19)
  })

  it('should return null for null input', () => {
    expect(parseBRDate(null)).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(parseBRDate('')).toBeNull()
  })

  it('should return null for invalid format', () => {
    expect(parseBRDate('2026-04-19')).toBeNull()
    expect(parseBRDate('19/04')).toBeNull()
    expect(parseBRDate('19/04/26')).toBeNull()
  })

  it('should return null for invalid dates', () => {
    expect(parseBRDate('32/04/2026')).toBeNull() // Invalid day
    expect(parseBRDate('19/13/2026')).toBeNull() // Invalid month
    expect(parseBRDate('19/04/999')).toBeNull()  // Invalid year length
  })

  it('should handle leap years correctly', () => {
    expect(parseBRDate('29/02/2024')?.getFullYear()).toBe(2024) // Valid leap year
    expect(parseBRDate('29/02/2023')).toBeNull() // Invalid leap year
  })

  it('should handle edge cases', () => {
    expect(parseBRDate('01/01/0001')).toBeInstanceOf(Date) // Minimum valid year
    expect(parseBRDate('31/12/9999')).toBeInstanceOf(Date) // Maximum reasonable year
  })
})
