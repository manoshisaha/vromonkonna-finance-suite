/**
 * TripsApi.gs
 *
 * Trips resource: reads/writes the Trips, TripHosts, Participants, and
 * Expenses sheets together, and writes contribution rows into Funds
 * whenever a trip is saved.
 *
 * MULTI-HOST MODEL: a trip has a Host Team (TripHosts rows), each host
 * with a Role (lead/coHost/support). Only the Lead Host's tier determines
 * the Host Budget on domestic trips (foreign trips use a flat
 * per-participant rate instead) — see js/modules/calculations.js, whose
 * logic this mirrors. The Host Budget and each host's split are trusted
 * from the client's `payload.financials` (already computed via
 * calculations.js), same design tradeoff as before: the formulas live in
 * exactly one place rather than being duplicated here.
 *
 * BACKWARD COMPATIBILITY: trips saved before multi-host support (using
 * the old single HostName/HostLifetimeTripCountAtBooking columns, with no
 * TripHosts rows) are synthesized into a one-host "lead" team on read, so
 * old data keeps working without any migration step.
 */

const TRIPS_SHEET = 'Trips';
const TRIP_HOSTS_SHEET = 'TripHosts';
const PARTICIPANTS_SHEET = 'Participants';
const EXPENSES_SHEET = 'Expenses';

function listTrips() {
  const trips = sheetToObjects_(getSheet_(TRIPS_SHEET));
  const tripHosts = sheetToObjects_(getSheet_(TRIP_HOSTS_SHEET));
  const participants = sheetToObjects_(getSheet_(PARTICIPANTS_SHEET));
  const expenses = sheetToObjects_(getSheet_(EXPENSES_SHEET));

  return trips.map((trip) => {
    const hostsForTrip = tripHosts.filter((h) => h.TripID === trip.TripID);

    const hosts = hostsForTrip.length > 0
      ? hostsForTrip.map((h) => ({
          name: h.HostName,
          role: h.Role,
          weight: h.RoleWeightSnapshot,
          lifetimeTripCount: h.LifetimeTripCountSnapshot,
          amount: h.Amount,
        }))
      : legacySingleHostFallback_(trip);

    return {
      id: trip.TripID,
      tripName: trip.TripName,
      destination: trip.Destination,
      tripDate: formatDate_(trip.TripDate),
      tripType: trip.TripType || 'domestic',
      packagePrice: trip.PackagePrice,
      maxParticipants: trip.MaxParticipants,
      otherIncome: trip.OtherIncome,
      status: trip.Status,
      notes: trip.Notes,
      hostBudget: trip.HostBudget,
      leadHostName: trip.LeadHostName || (hosts[0] && hosts[0].name),
      leadHostTierSnapshot: trip.LeadHostTierSnapshot,
      foreignHostBaseAmount: trip.ForeignHostBaseAmount,
      foreignHostRatePerParticipant: trip.ForeignHostRatePerParticipant,
      financialsSnapshot: buildFinancialsSnapshot_(trip),
      hosts: hosts,
      participants: participants
        .filter((p) => p.TripID === trip.TripID)
        .map((p) => ({
          name: p.Name,
          phone: p.Phone,
          paymentMode: p.PaymentMode,
          paidAmount: p.PaidAmount,
          dueAmount: p.DueAmount,
          paymentStatus: p.PaymentStatus,
        })),
      expenses: expenses
        .filter((x) => x.TripID === trip.TripID)
        .map((x) => ({ category: x.Category, amount: x.Amount, note: x.Note })),
    };
  });
}

/**
 * Builds the frozen settings-dependent financial snapshot for a trip, or
 * null if this trip predates snapshotting (so the frontend falls back to
 * a live recompute for it). Income/Expenses/GrossProfit aren't part of
 * this — see the column comment in SetupSheets.gs for why.
 */
function buildFinancialsSnapshot_(trip) {
  if (trip.TshirtFundSnapshot === '' || trip.TshirtFundSnapshot == null) return null;

  return {
    tshirtFund: trip.TshirtFundSnapshot,
    adjustedProfit: trip.AdjustedProfitSnapshot,
    remaining: trip.RemainingSnapshot,
    socialMediaFund: trip.SocialMediaFundSnapshot,
    organizationProfit: trip.OrganizationProfitSnapshot,
  };
}

/**
 * Synthesizes a one-host "lead" team from a legacy trip row (saved
 * before multi-host support existed, using the old HostName /
 * HostLifetimeTripCountAtBooking columns and no TripHosts rows).
 */
function legacySingleHostFallback_(trip) {
  if (!trip.HostName) return [];
  return [{
    name: trip.HostName,
    role: 'lead',
    weight: null,
    lifetimeTripCount: trip.HostLifetimeTripCountAtBooking,
    amount: trip.HostBudget || null,
  }];
}

function getTrip(tripId) {
  const trip = listTrips().find((t) => t.id === tripId);
  if (!trip) throw new Error('Trip not found: ' + tripId);
  return trip;
}

/**
 * Creates a new trip, or updates an existing one if payload.tripId is set.
 * On update, all existing TripHosts/Participants/Expenses/Funds rows for
 * that trip are removed and rewritten from the payload.
 */
function saveTrip(payload) {
  const isEdit = !!payload.tripId;
  const tripId = isEdit ? payload.tripId : Utilities.getUuid();
  const tripsSheet = getSheet_(TRIPS_SHEET);

  const hostTeam = payload.hosts || [];
  const leadHost = hostTeam.find((h) => h.role === 'lead') || hostTeam[0] || {};
  const financials = payload.financials || {};

  const tripRow = {
    TripID: tripId,
    TripName: payload.tripName,
    Destination: payload.destination,
    TripDate: payload.tripDate,
    TripType: payload.tripType || 'domestic',
    PackagePrice: payload.packagePrice,
    MaxParticipants: payload.maxParticipants || '',
    OtherIncome: payload.otherIncome || 0,
    Status: payload.status || 'Upcoming',
    Notes: payload.notes || '',
    HostBudget: financials.hostPayment != null ? financials.hostPayment : '',
    LeadHostName: leadHost.name || '',
    LeadHostTierSnapshot: financials.hostCategory || '',
    ForeignHostBaseAmount: payload.tripType === 'foreign' ? (payload.foreignHostBaseAmount || 0) : '',
    ForeignHostRatePerParticipant: payload.tripType === 'foreign' ? (payload.foreignHostRatePerParticipant || 0) : '',
    TshirtFundSnapshot: financials.tshirtFund != null ? financials.tshirtFund : '',
    AdjustedProfitSnapshot: financials.adjustedProfit != null ? financials.adjustedProfit : '',
    RemainingSnapshot: financials.remaining != null ? financials.remaining : '',
    SocialMediaFundSnapshot: financials.socialMediaFund != null ? financials.socialMediaFund : '',
    OrganizationProfitSnapshot: financials.organizationProfit != null ? financials.organizationProfit : '',
    // Legacy columns left blank on new/updated saves — TripHosts is now
    // the source of truth for host data. Kept only so old rows (and the
    // sheet's column structure) aren't disrupted.
    HostName: '',
    HostLifetimeTripCountAtBooking: '',
  };

  if (isEdit) {
    const rowNum = findRowNumberById_(tripsSheet, 'TripID', tripId);
    if (rowNum === -1) throw new Error('Trip not found for update: ' + tripId);
    updateRowFromObject_(tripsSheet, rowNum, tripRow);
    deleteRowsWhere_(getSheet_(TRIP_HOSTS_SHEET), 'TripID', tripId);
    deleteRowsWhere_(getSheet_(PARTICIPANTS_SHEET), 'TripID', tripId);
    deleteRowsWhere_(getSheet_(EXPENSES_SHEET), 'TripID', tripId);
    deleteRowsWhere_(getSheet_(FUNDS_SHEET), 'TripID', tripId);
  } else {
    appendObjectRow_(tripsSheet, tripRow);
    hostTeam.forEach((h) => incrementHostTripCount_(h.name));
  }

  const tripHostsSheet = getSheet_(TRIP_HOSTS_SHEET);
  const breakdownByName = {};
  (financials.hostBreakdown || []).forEach((b) => { breakdownByName[b.name] = b; });

  hostTeam.forEach((h) => {
    const breakdown = breakdownByName[h.name] || {};
    appendObjectRow_(tripHostsSheet, {
      TripHostID: Utilities.getUuid(),
      TripID: tripId,
      HostName: h.name,
      Role: h.role,
      RoleWeightSnapshot: breakdown.weight != null ? breakdown.weight : '',
      LifetimeTripCountSnapshot: h.lifetimeTripCount,
      Amount: breakdown.amount != null ? breakdown.amount : '',
    });
  });

  const participantsSheet = getSheet_(PARTICIPANTS_SHEET);
  (payload.participants || []).forEach((p) => {
    appendObjectRow_(participantsSheet, {
      ParticipantID: Utilities.getUuid(),
      TripID: tripId,
      Name: p.name,
      Phone: p.phone,
      PaymentMode: p.paymentMode,
      PaidAmount: p.paidAmount,
      DueAmount: p.dueAmount,
      PaymentStatus: p.paymentStatus,
    });
  });

  const expensesSheet = getSheet_(EXPENSES_SHEET);
  (payload.expenses || []).forEach((x) => {
    appendObjectRow_(expensesSheet, {
      ExpenseID: Utilities.getUuid(),
      TripID: tripId,
      Category: x.category,
      Amount: x.amount,
      Note: x.note || '',
    });
  });

  if (financials.socialMediaFund != null) {
    const fundsSheet = getSheet_(FUNDS_SHEET);
    [
      ['SocialMediaFund', financials.socialMediaFund],
      ['TshirtFund', financials.tshirtFund],
      ['OrganizationProfit', financials.organizationProfit],
    ].forEach(([fundType, amount]) => {
      appendObjectRow_(fundsSheet, {
        EntryID: Utilities.getUuid(),
        TripID: tripId,
        FundType: fundType,
        Date: payload.tripDate,
        Description: payload.tripName,
        EntryType: 'Contribution',
        Amount: amount,
      });
    });
  }

  return { tripId: tripId };
}

/** Deletes a trip and every TripHosts/Participants/Expenses/Funds row tied to it. */
function deleteTrip(tripId) {
  const tripsSheet = getSheet_(TRIPS_SHEET);
  const rowNum = findRowNumberById_(tripsSheet, 'TripID', tripId);
  if (rowNum !== -1) tripsSheet.deleteRow(rowNum);

  deleteRowsWhere_(getSheet_(TRIP_HOSTS_SHEET), 'TripID', tripId);
  deleteRowsWhere_(getSheet_(PARTICIPANTS_SHEET), 'TripID', tripId);
  deleteRowsWhere_(getSheet_(EXPENSES_SHEET), 'TripID', tripId);
  deleteRowsWhere_(getSheet_(FUNDS_SHEET), 'TripID', tripId);

  return { deleted: true };
}
