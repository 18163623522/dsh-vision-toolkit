import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { VolatileConfig, plainVisionConfig } from '../src/config.ts'
import { bindVisionSettings } from '../src/settings-compat.ts'

describe('0.1.7 Settings projection', () => {
  it('marks the editable fields volatile so the host exposes a form', () => {
    expect(VolatileConfig.dict.provider.dict.model.meta.volatile).toBe(true)
    expect(VolatileConfig.dict.runtime.dict.python.meta.volatile).toBe(true)
    expect(VolatileConfig.dict.imageInputVariants.dict.hidden.meta.volatile).toBe(true)
  })

  it('unwraps Loader values before runtime validation', () => {
    expect(plainVisionConfig(VolatileConfig({ language: 'en' }))).toMatchObject({ language: 'en' })
  })

  it('reads initial Loader config and applies a later document update', async () => {
    let listener: ((ns: string) => void) | undefined
    let value: object | undefined
    const update = vi.fn(async (_ns: string, patch: object) => { value = patch })
    const ctx = {
      settings: {
        describe: () => value === undefined ? [] : [{ ns: 'vision-toolkit', value }],
        update,
      },
      on: (_event: string, callback: (ns: string) => void) => {
        listener = callback
        return () => { listener = undefined }
      },
    } as unknown as Context
    const binding = bindVisionSettings(ctx, { language: 'zh' })
    expect(binding.get()).toEqual({ language: 'zh' })
    const changed = vi.fn()
    const dispose = binding.watch(changed)
    await binding.update({ language: 'en' })
    expect(update).toHaveBeenCalledWith('vision-toolkit', { language: 'en' })
    listener?.('other-entry')
    expect(changed).not.toHaveBeenCalled()
    listener?.('vision-toolkit')
    expect(changed).toHaveBeenCalledWith({ language: 'en' }, { language: 'zh' })
    listener?.('vision-toolkit')
    expect(changed).toHaveBeenCalledTimes(1)
    dispose()
    expect(listener).toBeUndefined()
  })
})
