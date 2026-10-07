export function connectorErrorRecovery(error, connectorName, reconnectHref) {
  const message = (error && error.message) || (connectorName + " is temporarily unavailable.");
  return reconnectHref
    ? { message, action: { href: reconnectHref, label: "Reconnect " + connectorName } }
    : { message };
}
