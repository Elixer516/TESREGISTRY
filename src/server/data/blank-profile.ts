/**
 * The profile fields the public enrollment form collects, as empty strings.
 *
 * A record created any other way — typed in by a registrar, or imported from
 * a CSV — has none of them, and there is no sensible value to invent. They
 * start blank and the registrar fills them in under Edit.
 *
 * Spread rather than repeated, so adding a field to the enrollment form is one
 * edit here instead of four identical ones across the services.
 */

export interface BlankProfileFields {
  addressRegion: string;
  addressProvince: string;
  addressCityMunicipality: string;
  addressBarangay: string;
  addressDistrict: string;
  addressStreet: string;
  birthRegion: string;
  birthProvince: string;
  birthCityMunicipality: string;
  bloodType: string;
  employmentStatus: string;
  disability: string;
  disabilitySpecify: string;
  socialMedia: string;
  socialMediaAccount: string;
  emergencyContactLastName: string;
  emergencyContactFirstName: string;
  emergencyContactMiddleName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  emergencyContactAddress: string;
}

export const BLANK_PROFILE: BlankProfileFields = {
  addressRegion: '',
  addressProvince: '',
  addressCityMunicipality: '',
  addressBarangay: '',
  addressDistrict: '',
  addressStreet: '',
  birthRegion: '',
  birthProvince: '',
  birthCityMunicipality: '',
  bloodType: '',
  employmentStatus: '',
  disability: '',
  disabilitySpecify: '',
  socialMedia: '',
  socialMediaAccount: '',
  emergencyContactLastName: '',
  emergencyContactFirstName: '',
  emergencyContactMiddleName: '',
  emergencyContactRelationship: '',
  emergencyContactNumber: '',
  emergencyContactAddress: '',
};
