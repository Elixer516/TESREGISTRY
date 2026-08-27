/**
 * The enrollment form's shape, its blank value, and the per-step validation.
 *
 * Kept beside the page rather than inside it so each step component can be a
 * plain function of this type, and so the "what is required to leave step N"
 * rule sits in one readable table instead of being scattered through JSX.
 */


export interface ApplyFormState {
  /* Step 1 — Main Details */
  firstName: string;
  extensionName: string;
  middleName: string;
  lastName: string;
  sex: 'MALE' | 'FEMALE';
  birthDate: string;
  civilStatus: string;
  addressRegion: string;
  addressProvince: string;
  addressCityMunicipality: string;
  addressBarangay: string;
  addressDistrict: string;
  addressStreet: string;

  /* Step 2 — Additional Details */
  birthRegion: string;
  birthProvince: string;
  birthCityMunicipality: string;
  bloodType: string;
  highestEducation: string;
  secondarySchool: string;
  secondarySchoolYearAttended: string;
  employmentStatus: string;
  disability: string;
  disabilitySpecify: string;

  /* Step 3 — Contact Details */
  email: string;
  contactNumber: string;
  socialMedia: string;
  socialMediaAccount: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  emergencyContactAddress: string;

  /* Step 4 — Diploma Details */
  programId: string;

  /* Step 5 — Identification Details (held in memory until submit) */
  idPicture: File | null;
  birthCertificate: File | null;
}

export const EMPTY_APPLY_FORM: ApplyFormState = {
  firstName: '',
  extensionName: '',
  middleName: '',
  lastName: '',
  sex: 'MALE',
  birthDate: '',
  civilStatus: 'Single',
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
  highestEducation: '',
  secondarySchool: '',
  secondarySchoolYearAttended: '',
  employmentStatus: '',
  disability: 'None',
  disabilitySpecify: '',

  email: '',
  contactNumber: '',
  socialMedia: '',
  socialMediaAccount: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  emergencyContactNumber: '',
  emergencyContactAddress: '',

  programId: '',

  idPicture: null,
  birthCertificate: null,
};

export type StepId =
  | 'MAIN'
  | 'ADDITIONAL'
  | 'CONTACT'
  | 'DIPLOMA'
  | 'IDENTIFICATION'
  | 'REVIEW';

export const APPLY_STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'MAIN', label: 'Main Details' },
  { id: 'ADDITIONAL', label: 'Additional Details' },
  { id: 'CONTACT', label: 'Contact Details' },
  { id: 'DIPLOMA', label: 'Diploma Details' },
  { id: 'IDENTIFICATION', label: 'Identification Details' },
  { id: 'REVIEW', label: 'Review' },
];

/**
 * What must be filled before the wizard will advance past a step.
 *
 * Only genuinely load-bearing fields are here. Blood type, social media and
 * the disability detail are all optional on the centre's own paper form, and
 * making them mandatory would just teach applicants to type junk.
 */
export function missingFieldsFor(step: StepId, form: ApplyFormState): string[] {
  const missing: string[] = [];

  if (step === 'MAIN') {
    if (!form.firstName.trim()) missing.push('First name');
    if (!form.lastName.trim()) missing.push('Last name');
    if (!form.birthDate) missing.push('Birthdate');
    if (!form.addressRegion) missing.push('Region');
    if (!form.addressCityMunicipality.trim()) missing.push('City/Municipality');
    if (!form.addressBarangay.trim()) missing.push('Barangay');
  } else if (step === 'ADDITIONAL') {
    if (!form.highestEducation) missing.push('Educational Attainment');
    if (!form.employmentStatus) missing.push('Employment Status');
    // "Other" without the detail tells the registrar nothing.
    if (form.disability === 'Other' && !form.disabilitySpecify.trim()) {
      missing.push('Specify (disability)');
    }
  } else if (step === 'CONTACT') {
    if (!form.email.trim()) missing.push('Email');
    if (!form.contactNumber.trim()) missing.push('Phone Number');
    if (!form.emergencyContactName.trim()) missing.push('Emergency contact name');
    if (!form.emergencyContactRelationship) missing.push('Relationship');
    if (!form.emergencyContactNumber.trim()) missing.push('Emergency contact phone number');
  } else if (step === 'DIPLOMA') {
    if (!form.programId) missing.push('Diploma');
  } else if (step === 'IDENTIFICATION') {
    if (!form.idPicture) missing.push('ID Picture');
    if (!form.birthCertificate) missing.push('Birth Certificate/NSO');
  }

  return missing;
}
