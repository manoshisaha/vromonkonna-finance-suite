/**
 * HostsApi.gs
 *
 * Hosts resource. Mirrors js/modules/host-directory.js exactly, so the
 * frontend swap from localStorage to this API is a drop-in replacement.
 */

const HOSTS_SHEET = 'Hosts';

function listHosts() {
  return sheetToObjects_(getSheet_(HOSTS_SHEET)).map((h) => ({
    id: h.HostID,
    name: h.Name,
    lifetimeTripCount: h.LifetimeTripCount,
  }));
}

function addHost(payload) {
  const sheet = getSheet_(HOSTS_SHEET);
  const hostId = Utilities.getUuid();
  appendObjectRow_(sheet, {
    HostID: hostId,
    Name: payload.name,
    LifetimeTripCount: payload.lifetimeTripCount || 0,
  });
  return { id: hostId };
}

function updateHost(hostId, updates) {
  const sheet = getSheet_(HOSTS_SHEET);
  const rowNum = findRowNumberById_(sheet, 'HostID', hostId);
  if (rowNum === -1) throw new Error('Host not found: ' + hostId);

  const current = listHosts().find((h) => h.id === hostId);
  updateRowFromObject_(sheet, rowNum, {
    HostID: hostId,
    Name: updates.name !== undefined ? updates.name : current.name,
    LifetimeTripCount: updates.lifetimeTripCount !== undefined ? updates.lifetimeTripCount : current.lifetimeTripCount,
  });
  return { updated: true };
}

function deleteHost(hostId) {
  const sheet = getSheet_(HOSTS_SHEET);
  const rowNum = findRowNumberById_(sheet, 'HostID', hostId);
  if (rowNum !== -1) sheet.deleteRow(rowNum);
  return { deleted: true };
}

/**
 * Increments a host's lifetime trip count by 1, matching by name
 * (case-insensitive), or creates them if they don't exist yet. Called
 * automatically by saveTrip() when a brand-new trip is created.
 */
function incrementHostTripCount_(hostName) {
  const hosts = listHosts();
  const existing = hosts.find(
    (h) => String(h.name).trim().toLowerCase() === String(hostName).trim().toLowerCase()
  );

  if (existing) {
    updateHost(existing.id, { lifetimeTripCount: Number(existing.lifetimeTripCount) + 1 });
  } else {
    addHost({ name: hostName, lifetimeTripCount: 1 });
  }
}
