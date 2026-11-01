import React from 'react';

export function FormInput({ label, name, type = 'text', value, onChange, placeholder, required = false, disabled = false }) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={name}>
          {label} {required && <span style={{ color: 'var(--red-600)' }}>*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        className="form-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}

export function FormSelect({ label, name, value, onChange, options = [], required = false, disabled = false }) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={name}>
          {label} {required && <span style={{ color: 'var(--red-600)' }}>*</span>}
        </label>
      )}
      <select
        id={name}
        name={name}
        className="form-select"
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
      >
        {options.map((opt, idx) => (
          <option key={idx} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormTextarea({ label, name, value, onChange, placeholder, rows = 3, required = false, disabled = false }) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={name}>
          {label} {required && <span style={{ color: 'var(--red-600)' }}>*</span>}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        rows={rows}
        className="form-textarea"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}

export function FormField({ label, required = false, children }) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label} {required && <span style={{ color: 'var(--red-600)' }}>*</span>}
        </label>
      )}
      {children}
    </div>
  );
}

export function Input(props) {
  return <input className={`form-input ${props.className || ''}`} {...props} />;
}

export function Select(props) {
  return <select className={`form-select ${props.className || ''}`} {...props} />;
}

export function Textarea(props) {
  return <textarea className={`form-textarea ${props.className || ''}`} {...props} />;
}


