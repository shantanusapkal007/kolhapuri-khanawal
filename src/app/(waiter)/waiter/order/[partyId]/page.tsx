import WaiterOrderClient from "./WaiterOrderClient";

export function generateStaticParams() {
  const partyIds = [
    "demo",
    "party-01",
    "party-02",
    "party-03",
    "party-04",
    "party-05",
    "party-06",
    "party-07",
    "party-08",
    "party-09",
    "party-10",
    "party-11",
    "party-12",
  ];
  return partyIds.map((partyId) => ({ partyId }));
}

export default async function WaiterOrderPage(props: {
  params: Promise<{ partyId: string }>;
}) {
  return <WaiterOrderClient params={props.params} />;
}
