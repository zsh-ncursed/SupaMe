// UI-примитивы панели свойств (презентационные, без стора)
import { clamp } from '../lib/utils';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="props-title">{children}</h3>;
}

export function NumField(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const v = Number.isFinite(props.value) ? props.value : 0;
  return (
    <label className="field">
      <span className="field__label">{props.label}</span>
      <input
        type="number"
        className="field__input"
        value={Math.round(v * 100) / 100}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        onChange={(e) => {
          const num = parseFloat(e.target.value);
          if (Number.isFinite(num)) {
            props.onChange(clamp(num, props.min ?? -Infinity, props.max ?? Infinity));
          }
        }}
      />
    </label>
  );
}

export function SliderField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field field--slider">
      <span className="field__label">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
      <span className="field__value">
        {props.display ? props.display(props.value) : props.value}
      </span>
    </label>
  );
}

export function ColorField(props: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(props.value) ? props.value : '#000000';
  return (
    <label className="field">
      <span className="field__label">{props.label}</span>
      <input
        type="color"
        className="field__color"
        value={hex}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

export function CheckField(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="field field--check">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="field__label">{props.label}</span>
    </label>
  );
}

export function SelectField<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span className="field__label">{props.label}</span>
      <select
        className="field__input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField(props: {
  label: string;
  value: string;
  rows?: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field field--area">
      <span className="field__label">{props.label}</span>
      <textarea
        rows={props.rows ?? 3}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

export function BtnRow({ children }: { children: React.ReactNode }) {
  return <div className="field field--row">{children}</div>;
}
