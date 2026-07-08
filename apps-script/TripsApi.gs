/**
 * TripsApi.gs
 *
 * Trips resource: reads/writes the Trips, Participants, and Expenses
 * sheets together, and writes contribution rows into Funds whenever a
 * trip is saved. Returns trips in exactly the shape
 * js/data/mock-trips.js already used, so swapping MOCK_TRIPS for a real
 * fetch() requires no changes to trip-utils.js, calculations.js, or any
 * page controller.
 *
 * Design note: this trusts `payload.financials` as computed client-side
 * by js/modules/calculations.js, rather than re-implementing the same
 * formulas in Apps Script. That keeps the business rules in exactly one
 * place. If stronger server-side guarantees are ever needed (e.g.
 * against a modified client), port calculations.js's logic here and
 * recompute instead of trusting the payload.
 */

const TRIPS_SHEET = 'Trips';
const PARTICIPANTS_SHEET = 'Participants';
const EXPENSES_SHEET = 'Expenses';

function listTrips() {
  const trips = sheetToObjects_(getSheet_(TRIPS_SHEET));
  const participants = sheetToObjects_(getSheet_(PARTICIPANTS_SHEET));
  const expenses = sheetToObjects_(getSheet_(EXPENSES_SHEET));

  return trips.map((trip) => ({
    id: trip.TripID,
    tripName: trip.TripName,
    destination: trip.Destination,
    tripDate: formatDate_(trip.TripDate),
    hostName: trip.HostName,
    hostLifetimeTripCount: trip.HostLifetimeTripCountAtBooking,
    packagePrice: trip.PackagePrice,
    maxParticipants: trip.MaxParticipants,
    otherIncome: trip.OtherIncome,
    status: trip.Status,
    notes: trip.Notes,
    participants: participants
      .filter((p) => p.TripID === trip.TripID)
      .map((p) => ({
        name: p.Name,
        phone: p.Phone,
        pickupPoint: p.PickupPoint,
        paidAmount: p.PaidAmount,
        dueAmount: p.DueAmount,
        paymentStatus: p.PaymentStatus,
      })),
    expenses: expenses
      .filter((x) => x.TripID === trip.TripID)
      .map((x) => ({ category: x.Category, amount: x.Amount, note: x.Note })),
  }));
}

function getTrip(tripId) {
  const trip = listTrips().find((t) => t.id === tripId);
  if (!trip) throw new Error('Trip not found: ' + tripId);
  return trip;
}

/**
 * Creates a new trip, or updates an existing one if payload.tripId is set.
 * On update, all existing Participants/Expenses/Funds rows for that trip
 * are removed and rewritten from the payload (simplest way to guarantee
 * they stay in sync with an edited trip).
 */
function saveTrip(payload) {
  const isEdit = !!payload.tripId;
  const tripId = isEdit ? payload.tripId : Utilities.getUuid();
  const tripsSheet = getSheet_(TRIPS_SHEET);

  const tripRow = {
    TripID: tripId,
    TripName: payload.tripName,
    Destination: payload.destination,
    TripDate: payload.tripDate,
    HostName: payload.hostName,
    HostLifetimeTripCountAtBooking: payload.hostTripCount,
    PackagePrice: payload.packagePrice,
    MaxParticipants: payload.maxParticipants || '',
    OtherIncome: payload.otherIncome || 0,
    Status: payload.status || 'Upcoming',
    Notes: payload.notes || '',
  };

  if (isEdit) {
    const rowNum = findRowNumberById_(tripsSheet, 'TripID', tripId);
    if (rowNum === -1) throw new Error('Trip not found for update: ' + tripId);
    updateRowFromObject_(tripsSheet, rowNum, tripRow);
    deleteRowsWhere_(getSheet_(PARTICIPANTS_SHEET), 'TripID', tripId);
    deleteRowsWhere_(getSheet_(EXPENSES_SHEET), 'TripID', tripId);
    deleteRowsWhere_(getSheet_(FUNDS_SHEET), 'TripID', tripId);
  } else {
    appendObjectRow_(tripsSheet, tripRow);
    incrementHostTripCount_(payload.hostName);
  }

  const participantsSheet = getSheet_(PARTICIPANTS_SHEET);
  (payload.participants || []).forEach((p) => {
    appendObjectRow_(participantsSheet, {
      ParticipantID: Utilities.getUuid(),
      TripID: tripId,
      Name: p.name,
      Phone: p.phone,
      PickupPoint: p.pickupPoint,
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

  if (payload.financials) {
    const fundsSheet = getSheet_(FUNDS_SHEET);
    [
      ['SocialMediaFund', payload.financials.socialMediaFund],
      ['TshirtFund', payload.financials.tshirtFund],
      ['OrganizationProfit', payload.financials.organizationProfit],
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

/** Deletes a trip and every Participants/Expenses/Funds row tied to it. */
function deleteTrip(tripId) {
  const tripsSheet = getSheet_(TRIPS_SHEET);
  const rowNum = findRowNumberById_(tripsSheet, 'TripID', tripId);
  if (rowNum !== -1) tripsSheet.deleteRow(rowNum);

  deleteRowsWhere_(getSheet_(PARTICIPANTS_SHEET), 'TripID', tripId);
  deleteRowsWhere_(getSheet_(EXPENSES_SHEET), 'TripID', tripId);
  deleteRowsWhere_(getSheet_(FUNDS_SHEET), 'TripID', tripId);

  return { deleted: true };
}
