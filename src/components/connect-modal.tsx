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
        className="sm:max-w-[600px] text-white px-10 py-8 rounded-xl bg-black"
      >
        <DialogHeader>
          <DialogTitle className="text-3xl mb-3 text-white uppercase">
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
              className=" bg-[#836EF9] hover:bg-[#836EF9]/70 transition-all duration-300 ease-in-out flex items-center justify-center rounded h-[66px] px-2 font-thin text-xl sm:text-2xl"
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
