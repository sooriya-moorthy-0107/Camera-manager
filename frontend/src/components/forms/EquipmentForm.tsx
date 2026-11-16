'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { equipmentSchema, EquipmentFormData } from '@/lib/validations';
import { UserProfile } from '@/types';

interface EquipmentFormProps {
  currentUserProfile?: UserProfile | null;
  existingSerialNumbers?: string[];
  onSubmit: (data: EquipmentFormData) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
}

const CATEGORIES = ['Camera', 'Lens', 'Audio', 'Stabilizer', 'Lighting', 'Accessory', 'Other'];

export const EquipmentForm: React.FC<EquipmentFormProps> = ({
  currentUserProfile,
  existingSerialNumbers = [],
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<EquipmentFormData>({
    name: '',
    category: 'Camera',
    serial_number: '',
    entered_by: currentUserProfile?.id || null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enteredByDisplay = currentUserProfile
    ? `${currentUserProfile.full_name} - ${currentUserProfile.register_number}`
    : 'Admin Organizer - REG-ADMIN-01';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'serial_number' ? value.toUpperCase() : value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validation = equipmentSchema.safeParse({
      ...formData,
      entered_by: currentUserProfile?.id || null,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const path = issue.path[0]?.toString() || 'form';
        fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    // Unique serial number check
    const normalizedSerial = validation.data.serial_number.toUpperCase();
    if (
      existingSerialNumbers.some(
        (sn) => sn.toUpperCase() === normalizedSerial
      )
    ) {
      setErrors({
        serial_number: `Serial number "${normalizedSerial}" already exists in the inventory`,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onSubmit(validation.data);
      if (!res.success) {
        setServerError(res.error || 'Failed to add equipment');
      } else {
        setFormData({
          name: '',
          category: 'Camera',
          serial_number: '',
          entered_by: currentUserProfile?.id || null,
        });
        setErrors({});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="p-3 bg-neutral-100 border border-neutral-400 text-neutral-900 text-xs rounded">
          {serverError}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
          Equipment Name
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g. Sony Alpha A7 IV (Body)"
          className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
        />
        {errors.name && <p className="mt-1 text-xs text-neutral-900 font-medium">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
          Category
        </label>
        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1 text-xs text-neutral-900 font-medium">{errors.category}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
          Serial Number
        </label>
        <input
          type="text"
          name="serial_number"
          value={formData.serial_number}
          onChange={handleChange}
          placeholder="e.g. SN-SNY-9481"
          className="w-full px-3 py-2 text-sm uppercase bg-white border border-neutral-300 rounded focus:outline-none focus:border-black font-mono"
        />
        {errors.serial_number && (
          <p className="mt-1 text-xs text-neutral-900 font-medium">{errors.serial_number}</p>
        )}
      </div>

      <div className="pt-2 border-t border-neutral-200">
        <div className="text-xs text-neutral-600 mb-3">
          Entered By:{' '}
          <span className="font-semibold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
            {enteredByDisplay}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
            Add Equipment
          </Button>
        </div>
      </div>
    </form>
  );
};
