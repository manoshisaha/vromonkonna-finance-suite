/**
 * Security.gs
 *
 * Run setApiKey() ONCE, manually, to store the shared secret key used to
 * authorize every request (see isAuthorized_() in Code.gs). Storing it as
 * a script property (rather than a hardcoded constant) means it won't be
 * visible in this source file if the project is ever shared or copied.
 *
 * The key itself is generated on the frontend side and must match exactly
 * what's in js/modules/config.js's API_KEY constant.
 */

function setApiKey() {
  const key = 'zecG-0lOoU0aU_9OB71zYguoPZCtoNfc_8YxUyx6sx8';
  PropertiesService.getScriptProperties().setProperty('API_KEY', key);
  Logger.log('API key stored.');
}
