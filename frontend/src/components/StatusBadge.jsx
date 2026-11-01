import React from 'react';

export default function StatusBadge({ status }) {
  if (!status) return null;

  const normalized = String(status).toUpperCase();

  let typeClass = 'badge-neutral';

  if (['COMMISSIONED', 'COMPLETED', 'ACCEPTED', 'ACTIVE', 'TIER_1', 'VERIFIED', 'DELIVERED', 'HEALTHY', 'INVENTORY_ALLOCATED', 'ALLOCATED', 'SUFFICIENT'].includes(normalized)) {
    typeClass = 'badge-success';
  } else if (['NEW', 'SCHEDULED', 'SURVEY_SCHEDULED', 'PREPARING', 'IN_PROGRESS', 'PENDING', 'TIER_2', 'PENDING_ALLOCATION', 'PARTIALLY_ALLOCATED', 'PARTIAL_ALLOCATION'].includes(normalized)) {
    typeClass = 'badge-warning';
  } else if (['QUOTED', 'DISPATCHED', 'SURVEY_COMPLETED', 'CONFIRMED', 'BOM_GENERATED'].includes(normalized)) {
    typeClass = 'badge-info';
  } else if (['REJECTED', 'FAILED', 'MISMATCH', 'DAMAGED', 'EXPIRED', 'OFFLINE', 'SHORTAGE', 'LOW_STOCK', 'TIER_3'].includes(normalized)) {
    typeClass = 'badge-danger';
  }

  // Format label: replace underscores with spaces
  const label = normalized.replace(/_/g, ' ');

  return <span className={`badge ${typeClass}`}>{label}</span>;
}

