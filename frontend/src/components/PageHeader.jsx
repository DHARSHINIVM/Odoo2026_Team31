import React from 'react';

export default function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div className="page-title-group">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

