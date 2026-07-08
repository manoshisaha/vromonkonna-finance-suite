/**
 * js/modules/participant-utils.js
 *
 * Builds a cross-trip participant directory from a list of trips. Groups
 * participant records by a *normalized phone number* (not name — names
 * collide far too often), and flags likely data-quality issues for a
 * human to review rather than silently merging or splitting records:
 *
 *   - multipleNamesSamePhone: the same phone appears under >1 name
 *     (possible shared/family phone, or a typo in one of the names)
 *   - sameNameDifferentPhone: the same name appears under >1 phone
 *     (possibly two different people, or the person changed numbers)
 *
 * No DOM access — pure data in, data out.
 */

/**
 * Normalizes a Bangladeshi phone number for matching: strips all
 * non-digit characters, removes the '880' country code if present, and
 * ensures a leading '0' for local 11-digit form.
 * @param {string} phone
 * @returns {string} normalized digits-only phone, or '' if empty/invalid
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  if (digits && !digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

/**
 * @typedef {Object} DirectoryEntry
 * @property {string} phoneKey       - normalized phone, or a name-based fallback key if phone is blank
 * @property {string} phone          - most recent raw phone value on file
 * @property {string} displayName    - most recently used name for this key
 * @property {string[]} allNamesUsed - every distinct name seen under this key
 * @property {Object[]} trips        - trip participation records, most recent first
 * @property {number} tripCount
 * @property {number} totalPaid
 * @property {number} totalDue
 * @property {{ multipleNamesSamePhone: boolean, sameNameDifferentPhone: boolean }} flags
 */

/**
 * Builds the participant directory from a list of trips (each with a
 * `.participants` array as produced by New Trip / Trip History).
 * @param {Object[]} trips
 * @returns {DirectoryEntry[]} sorted alphabetically by displayName
 */
export function buildParticipantDirectory(trips) {
  const byPhone = new Map();

  trips.forEach((trip) => {
    trip.participants.forEach((p) => {
      const normalized = normalizePhone(p.phone);
      const key = normalized || `__noPhone:${p.name.trim().toLowerCase()}`;

      if (!byPhone.has(key)) {
        byPhone.set(key, { phoneKey: key, phone: p.phone, names: [], trips: [], totalPaid: 0, totalDue: 0 });
      }
      const entry = byPhone.get(key);
      if (p.phone) entry.phone = p.phone;
      if (!entry.names.includes(p.name)) entry.names.push(p.name);
      entry.trips.push({
        tripId: trip.id,
        tripName: trip.tripName,
        tripDate: trip.tripDate,
        name: p.name,
        paidAmount: p.paidAmount,
        dueAmount: p.dueAmount,
        pickupPoint: p.pickupPoint,
        paymentStatus: p.paymentStatus,
      });
      entry.totalPaid += p.paidAmount;
      entry.totalDue += p.dueAmount;
    });
  });

  // Map each distinct name -> set of phoneKeys it has appeared under, to
  // detect "same name, different phone" across the whole directory.
  const nameToPhoneKeys = new Map();
  byPhone.forEach((entry, key) => {
    entry.names.forEach((name) => {
      const normName = name.trim().toLowerCase();
      if (!nameToPhoneKeys.has(normName)) nameToPhoneKeys.set(normName, new Set());
      nameToPhoneKeys.get(normName).add(key);
    });
  });

  const directory = Array.from(byPhone.values()).map((entry) => {
    const sortedTrips = [...entry.trips].sort((a, b) => new Date(b.tripDate) - new Date(a.tripDate));
    const displayName = sortedTrips[0]?.name || entry.names[0];

    const sameNameDifferentPhone = entry.names.some(
      (name) => (nameToPhoneKeys.get(name.trim().toLowerCase())?.size || 0) > 1
    );

    return {
      phoneKey: entry.phoneKey,
      phone: entry.phone,
      displayName,
      allNamesUsed: entry.names,
      trips: sortedTrips,
      tripCount: entry.trips.length,
      totalPaid: entry.totalPaid,
      totalDue: entry.totalDue,
      flags: {
        multipleNamesSamePhone: entry.names.length > 1,
        sameNameDifferentPhone,
      },
    };
  });

  return directory.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
