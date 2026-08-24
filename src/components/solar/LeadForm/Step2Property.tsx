import { useCallback } from 'react';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';
import { PropertyLocationMap } from './PropertyLocationMap';

export function Step2Property({ onNext, onBack, data, updateData }: any) {
  const handleLocationChange = useCallback(
    (payload: { address?: string; lat?: number; lng?: number }) => {
      updateData({
        ...(payload.address != null ? { address: payload.address } : {}),
        ...(payload.lat != null ? { propertyLat: payload.lat } : {}),
        ...(payload.lng != null ? { propertyLng: payload.lng } : {}),
      });
    },
    [updateData],
  );

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">Where is the property?</h3>

      <AddressAutocompleteInput
        value={String(data.address || '')}
        onChange={(address) =>
          updateData({
            address,
            // Clear pin while typing so we don't keep a stale location for a new address.
            propertyLat: null,
            propertyLng: null,
          })
        }
        onPlaceSelect={({ address, lat, lng }) =>
          updateData({
            address,
            propertyLat: lat != null ? lat : null,
            propertyLng: lng != null ? lng : null,
          })
        }
      />

      <PropertyLocationMap
        address={String(data.address || '')}
        lat={data.propertyLat != null ? Number(data.propertyLat) : undefined}
        lng={data.propertyLng != null ? Number(data.propertyLng) : undefined}
        onLocationChange={handleLocationChange}
      />

      <div className="grid grid-cols-2 gap-2 mt-4">
        {['Residential', 'Commercial'].map((type) => (
          <button
            key={type}
            type="button"
            className={`form-chip ${data.propertyType === type ? 'form-chip-active' : ''}`}
            onClick={() => updateData({ propertyType: type })}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="flex gap-4 mt-6">
        <button
          type="button"
          onClick={onBack}
          className="w-1/3 bg-white/5 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="w-2/3 bg-cyan-500 text-navy-dark font-bold py-4 rounded-xl hover:bg-cyan-400 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
