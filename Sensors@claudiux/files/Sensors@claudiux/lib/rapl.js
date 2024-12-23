const { Message, Session } = imports.gi.Soup;

const session = new Session();
session.timeout = 2;

function fetchCPUInformation(host, port) {
  const message = Message.new('GET', `${host}:${port}/persecond`);
  message.request_headers.append('Accept', 'application/json');
  const result = session.send_and_read(message, null);
  const data = result.get_data();
  const responseString = new TextDecoder('utf-8').decode(data);
  return JSON.parse(responseString);
}

function fetchCPUWattage(host, port, numberOfDecimals) {
  let result = fetchCPUInformation(host, port);
  result = Number(result['Uncore Aggregate']['Uncore Counters']['Package Joules Consumed']);
  return numberOfDecimals > 0 ? result.toFixed(numberOfDecimals) : Math.round(result);
}

module.exports = {
  fetchCPUWattage
}