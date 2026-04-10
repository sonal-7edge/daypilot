// Fallback list used when the Tempo Accounts API is unavailable.
// TODO: Add role-based default account mapping once roles are confirmed, e.g.:
//   dev      → INT-AI-TP
//   designer → CLOUD_NATIVE_ENG_OPEX
//   set      → CUST_ORDO
const FALLBACK_ACCOUNTS = [
  'CLOUD_NATIVE_ENG_OPEX',
  'CUST_ORDO',
  'CUST_ORDO_Non_Billable',
  'INT-AI-TP',
  'INT-ORG-COMMUNITY-INITIATIVE',
  'INT-ORG-INNOVATION-TIME',
  'OPEX',
];

export function registerAccountTools(server, apiClient) {
  server.tool(
    'get_user_accounts',
    `Fetch the Tempo billing accounts available to this user from the live Tempo API.
     Falls back to a standard list if the Tempo Accounts module is not enabled.
     Always call this before asking the user to pick an account — never hardcode the list.`,
    {},
    async () => {
      let accounts = [];
      try {
        const res = await apiClient.get('/api/tempo/accounts');
        accounts = res.data;
      } catch {
        // silently fall through to fallback
      }

      // If Tempo Accounts API returned nothing, use the fallback list
      if (!accounts.length) {
        accounts = FALLBACK_ACCOUNTS.map(key => ({ key, name: key }));
      }

      const lines = accounts.map((a, i) => `${i + 1}. ${a.key}${a.name && a.name !== a.key ? `  (${a.name})` : ''}`);
      return {
        content: [{
          type: 'text',
          text: `Available billing accounts:\n\n${lines.join('\n')}\n\nAsk the user to pick one by number or name.`,
        }],
      };
    }
  );
}
