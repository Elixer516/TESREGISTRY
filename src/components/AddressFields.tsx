import { useId, useMemo } from 'react';
import { Field, Select, TextInput } from '@/components/ui';
import {
  REGIONS,
  barangaysFor,
  barangaysInRegion,
  citiesInRegion,
  districtsFor,
  provincesFor,
} from '@/lib/psgc';

/** The address parts every form shares. */
export interface AddressValue {
  addressRegion: string;
  addressStreet: string;
  addressBarangay: string;
  addressDistrict: string;
  addressCityMunicipality: string;
  addressProvince: string;
  addressCountry: string;
}

type AddressKey = keyof AddressValue;

/** What a barangay suggestion reads as before the municipality is known. */
const SEPARATOR = ' · ';

/**
 * The address in the centre's order: Region, then Street, Barangay, District,
 * Municipality, Province and Country.
 *
 * The lists still narrow each other even though the small parts come first.
 * The barangay box suggests every barangay of the region with its
 * municipality ("Panacan · Davao City"), and choosing one fills the
 * municipality and province too. The municipality list holds the whole region
 * until a province is chosen, and choosing a municipality fills its province.
 * Wherever we hold no list, the field is typed.
 */
export function AddressFields({
  value,
  set,
  idPrefix,
  required = true,
}: {
  value: AddressValue;
  set: (key: AddressKey, next: string) => void;
  idPrefix: string;
  /** Region, barangay and municipality are required on the application. */
  required?: boolean;
}) {
  const listId = useId();
  const provinces = provincesFor(value.addressRegion);
  const places = useMemo(() => citiesInRegion(value.addressRegion), [value.addressRegion]);
  const cityChoices = value.addressProvince
    ? places.filter((p) => p.province === value.addressProvince)
    : places;
  // A name two provinces share is told apart by its province.
  const ambiguous = new Set(
    places.filter((p, i) => places.findIndex((q) => q.city === p.city) !== i).map((p) => p.city),
  );
  const districts = districtsFor(value.addressCityMunicipality);

  const ownBarangays = barangaysFor(value.addressProvince, value.addressCityMunicipality);
  const regionBarangays = useMemo(
    () => (value.addressCityMunicipality ? [] : barangaysInRegion(value.addressRegion)),
    [value.addressRegion, value.addressCityMunicipality],
  );

  const chooseCity = (province: string, city: string) => {
    if (city !== value.addressCityMunicipality) set('addressDistrict', '');
    set('addressCityMunicipality', city);
    if (province) set('addressProvince', province);
  };

  const onBarangay = (typed: string) => {
    // A suggestion that carries its municipality fills that in as well.
    const at = typed.lastIndexOf(SEPARATOR);
    if (at > 0 && regionBarangays.length) {
      const name = typed.slice(0, at);
      const city = typed.slice(at + SEPARATOR.length);
      const match = regionBarangays.find((b) => b.barangay === name && b.city === city);
      if (match) {
        set('addressBarangay', match.barangay);
        chooseCity(match.province, match.city);
        return;
      }
    }
    set('addressBarangay', typed);
  };

  const cityKey = (province: string, city: string) => `${province}|${city}`;
  const currentCity = places.find(
    (p) =>
      p.city === value.addressCityMunicipality &&
      (!value.addressProvince || !p.province || p.province === value.addressProvince),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Region" htmlFor={`${idPrefix}-region`} required={required}>
          <Select
            id={`${idPrefix}-region`}
            value={value.addressRegion}
            onChange={(e) => {
              // The narrower fields describe the old region, so they go.
              set('addressRegion', e.target.value);
              set('addressProvince', '');
              set('addressCityMunicipality', '');
              set('addressDistrict', '');
            }}
          >
            <option value="">Select…</option>
            {REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Street" htmlFor={`${idPrefix}-street`} className="sm:col-span-2">
          <TextInput
            id={`${idPrefix}-street`}
            value={value.addressStreet}
            onChange={(e) => set('addressStreet', e.target.value)}
            placeholder="House number, street, purok"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Barangay"
          htmlFor={`${idPrefix}-barangay`}
          required={required}
          hint={
            ownBarangays.length || regionBarangays.length
              ? 'Pick from the list, or type it if yours is not there.'
              : undefined
          }
        >
          <TextInput
            id={`${idPrefix}-barangay`}
            value={value.addressBarangay}
            onChange={(e) => onBarangay(e.target.value)}
            list={ownBarangays.length || regionBarangays.length ? listId : undefined}
            autoComplete="off"
          />
          {ownBarangays.length ? (
            <datalist key={`own-${value.addressCityMunicipality}`} id={listId}>
              {ownBarangays.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : regionBarangays.length ? (
            <datalist key="region" id={listId}>
              {regionBarangays.map((b) => (
                <option key={`${b.city}|${b.barangay}`} value={`${b.barangay}${SEPARATOR}${b.city}`} />
              ))}
            </datalist>
          ) : null}
        </Field>

        <Field label="District" htmlFor={`${idPrefix}-district`}>
          {districts.length ? (
            <Select
              id={`${idPrefix}-district`}
              value={value.addressDistrict}
              onChange={(e) => set('addressDistrict', e.target.value)}
            >
              <option value="">Select…</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          ) : (
            <TextInput
              id={`${idPrefix}-district`}
              value={value.addressDistrict}
              onChange={(e) => set('addressDistrict', e.target.value)}
            />
          )}
        </Field>

        <Field label="City/Municipality" htmlFor={`${idPrefix}-city`} required={required}>
          {cityChoices.length ? (
            <Select
              id={`${idPrefix}-city`}
              value={currentCity ? cityKey(currentCity.province, currentCity.city) : ''}
              onChange={(e) => {
                const [province, city] = e.target.value.split('|');
                chooseCity(province ?? '', city ?? '');
              }}
            >
              <option value="">Select…</option>
              {cityChoices.map((p) => (
                <option key={cityKey(p.province, p.city)} value={cityKey(p.province, p.city)}>
                  {p.city}
                  {ambiguous.has(p.city) && !value.addressProvince ? ` (${p.province})` : ''}
                </option>
              ))}
            </Select>
          ) : (
            <TextInput
              id={`${idPrefix}-city`}
              value={value.addressCityMunicipality}
              onChange={(e) => set('addressCityMunicipality', e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Province" htmlFor={`${idPrefix}-province`}>
          {provinces.length ? (
            <Select
              id={`${idPrefix}-province`}
              value={value.addressProvince}
              onChange={(e) => {
                const province = e.target.value;
                set('addressProvince', province);
                // A municipality from another province no longer fits.
                if (!places.some((p) => p.province === province && p.city === value.addressCityMunicipality)) {
                  set('addressCityMunicipality', '');
                  set('addressDistrict', '');
                }
              }}
            >
              <option value="">Select…</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          ) : (
            <TextInput
              id={`${idPrefix}-province`}
              value={value.addressProvince}
              onChange={(e) => set('addressProvince', e.target.value)}
              placeholder={value.addressRegion === 'NCR' ? 'Not applicable' : undefined}
            />
          )}
        </Field>
        <Field label="Country" htmlFor={`${idPrefix}-country`}>
          <TextInput
            id={`${idPrefix}-country`}
            value={value.addressCountry}
            onChange={(e) => set('addressCountry', e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
