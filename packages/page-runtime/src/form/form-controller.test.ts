import { describe, expect, it } from 'vitest';
import type { LinkageRule } from '@lc/schema';
import { FormController } from './form-controller.js';
import type { FieldOption, FormFieldHandle } from './types.js';
import { buildSubmitContext, buildSubmitRequest } from './submit.js';
import { matchWhen } from './linkage.js';

class FakeField implements FormFieldHandle {
  value: unknown;
  error: string | null = null;
  hidden = false;
  disabled = false;
  required = false;
  options: FieldOption[] = [];

  constructor(readonly name: string, value?: unknown) {
    this.value = value;
  }

  getValue(): unknown {
    return this.value;
  }

  setValue(value: unknown): void {
    this.value = value;
    this.error = null;
  }

  setError(message: string | null): void {
    this.error = message;
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
  }

  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
  }

  setRequired(required: boolean): void {
    this.required = required;
  }

  setOptions(options: FieldOption[]): void {
    this.options = options;
  }

  isHidden(): boolean {
    return this.hidden;
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  isRequired(): boolean {
    return this.required;
  }

  getOptions(): FieldOption[] {
    return this.options;
  }

  async validate(): Promise<string | null> {
    const empty = this.value === undefined || this.value === null || this.value === '';
    return this.required && empty ? `${this.name} required` : null;
  }
}

const hideLinkage: LinkageRule[] = [
  {
    when: { field: 'type', op: 'eq', value: 'personal' },
    then: [{ target: 'companyName', action: 'hide' }],
  },
];

describe('FormController', () => {
  it('collects values from registered fields and applies initial values', () => {
    const controller = new FormController({ initialValues: { name: '张三' } });
    const name = new FakeField('name');
    const age = new FakeField('age', 18);

    controller.register(name);
    controller.register(age);

    expect(name.value).toBe('张三');
    expect(controller.getValues()).toEqual({ name: '张三', age: 18 });
  });

  it('stores values set before the field is registered', () => {
    const controller = new FormController();
    controller.setValues({ email: 'a@b.com' });

    const email = new FakeField('email');
    controller.register(email);

    expect(email.value).toBe('a@b.com');
    expect(controller.getValues().email).toBe('a@b.com');
  });

  it('validates all fields and exposes errors', async () => {
    const controller = new FormController();
    const username = new FakeField('username');
    username.required = true;
    const remark = new FakeField('remark', 'ok');
    controller.register(username);
    controller.register(remark);

    const result = await controller.validate();

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual({ username: 'username required' });
    expect(username.error).toBe('username required');
    expect(remark.error).toBeNull();

    username.setValue('张三');
    await expect(controller.validate()).resolves.toEqual({ valid: true, errors: {} });
  });

  it('applies linkages on field change and register', () => {
    const controller = new FormController({ linkages: hideLinkage });
    const type = new FakeField('type', 'company');
    const companyName = new FakeField('companyName', 'ACME');
    controller.register(type);
    controller.register(companyName);

    expect(companyName.hidden).toBe(false);

    type.setValue('personal');
    controller.handleFieldChange('type', 'personal');
    expect(companyName.hidden).toBe(true);

    type.setValue('company');
    controller.handleFieldChange('type', 'company');
    expect(companyName.hidden).toBe(false);
  });

  it('resets to initial values and clears errors', async () => {
    const controller = new FormController({ initialValues: { name: '初始值' } });
    const name = new FakeField('name');
    controller.register(name);
    name.setValue('修改后');
    name.setError('出错');

    controller.reset();

    expect(name.value).toBe('初始值');
    expect(name.error).toBeNull();
  });

  it('matches and/or conditions', () => {
    const values = { type: 'personal', level: 2 };
    expect(
      matchWhen(
        {
          and: [
            { field: 'type', op: 'eq', value: 'personal' },
            { field: 'level', op: 'gte', value: 2 },
          ],
        },
        values,
      ),
    ).toBe(true);
    expect(
      matchWhen(
        {
          or: [
            { field: 'type', op: 'eq', value: 'company' },
            { field: 'level', op: 'gt', value: 5 },
          ],
        },
        values,
      ),
    ).toBe(false);
  });
});

describe('buildSubmitRequest', () => {
  it('uses form values as POST body by default', () => {
    const request = buildSubmitRequest(
      { url: '/api/users', method: 'POST' },
      { name: '张三', age: 18 },
    );
    expect(request.body).toEqual({ name: '张三', age: 18 });
    expect(buildSubmitContext({ name: '张三' })).toMatchObject({
      name: '张三',
      values: { name: '张三' },
      form: { name: '张三' },
    });
  });

  it('keeps an explicit body and maps GET values to params', () => {
    const post = buildSubmitRequest(
      { url: '/api/users', method: 'POST', body: { nested: '{{form.name}}' } },
      { name: '张三' },
    );
    expect(post.body).toEqual({ nested: '{{form.name}}' });

    const get = buildSubmitRequest(
      { url: '/api/users', method: 'GET', params: { page: 1 } },
      { name: '张三' },
    );
    expect(get.params).toEqual({ name: '张三', page: 1 });
  });
});
