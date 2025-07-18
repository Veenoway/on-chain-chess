"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/lib/shadcn/modal";
import { FC, PropsWithChildren } from "react";
import { useConnect } from "wagmi";

export const WalletModal: FC<
  PropsWithChildren & { open: boolean; setOpen: (value: boolean) => void }
> = ({ children, open, setOpen }) => {
  const { connect, connectors } = useConnect();
  return (
    <Dialog open={open}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        close={() => setOpen(false)}
        className="sm:max-w-[600px] text-white px-10 py-8 rounded-2xl bg-[#1E1E1E] border border-white/5 backdrop-blur-md"
      >
        <DialogHeader>
          <DialogTitle className="text-3xl mb-3 text-white">
            Connect Wallet
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-5 w-full">
          {connectors?.map((connector, i) => (
            <button
              key={i}
              style={{
                width: "calc(50% - 10px)",
              }}
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
              className=" bg-[#252525] hover:border-[#836EF9] hover:bg-[#836EF9]/20 border border-white/5 transition-all duration-300 ease-in-out flex items-center justify-center rounded h-[50px] px-2 font-thin text-base sm:text-lg"
            >
              <img
                src={connector.icon}
                alt={connector.name}
                className="w-6 h-6 mr-3"
              />
              {connector.name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
