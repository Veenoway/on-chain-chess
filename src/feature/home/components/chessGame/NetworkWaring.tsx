import { useAccount } from "wagmi";

export default function NetworkWarning({
  onSwitchNetwork,
}: {
  onSwitchNetwork: () => void;
}) {
  const { chainId } = useAccount();

  return (
    <div className="bg-red-500/20 border border-red-400 rounded-xl p-4">
      <div className="text-center">
        <h3 className="text-red-300 font-bold text-lg mb-2">
          ⚠️ Wrong Network Detected
        </h3>
        <p className="text-red-200 mb-2">
          Please switch to <strong>Monad Testnet</strong> to use betting
          features
        </p>
        <p className="text-red-300 text-sm mb-4">
          Required Chain ID: <strong>10143</strong> | Current Chain ID:{" "}
          <strong>{chainId}</strong>
        </p>
        <button
          onClick={onSwitchNetwork}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
        >
          🔄 Switch to Monad Testnet
        </button>
      </div>
    </div>
  );
}
