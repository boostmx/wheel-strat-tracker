"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CreatePortfolioModal } from "@/components/create-portfolio-modal";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface Portfolio {
  id: string;
  name: string | null;
  startingCapital: number;
  currentCapital: number;
}

export default function DashboardContent() {
  const { data: session } = useSession();

  const {
    data: portfolios = [],
    error,
    isLoading,
  } = useSWR<Portfolio[]>(session?.user?.id ? "/api/portfolios" : null);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/portfolios/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }

      toast.success("Portfolio deleted");
      mutate("/api/portfolios");
    } catch (err) {
      toast.error("Failed to delete portfolio");
      console.error(err);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-16 px-6 space-y-10">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Your Portfolios</h1>
        <CreatePortfolioModal />
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading portfolios...</p>
      ) : error ? (
        <p className="text-red-500">Failed to load portfolios.</p>
      ) : portfolios.length === 0 ? (
        <div className="rounded-lg border border-gray-200 p-6 text-center shadow-sm bg-white">
          <p className="text-gray-600 mb-4 text-sm">
            You have not created any portfolios yet. Create one to get started!
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mb-6">
          {portfolios.map((p) => (
            <Card
              key={p.id}
              className="relative hover:shadow-lg hover:-translate-y-1 transition duration-200"
            >
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 px-2 py-1 text-sm text-red-600 border border-red-500 rounded hover:bg-red-50 transition"
                  >
                    -
                  </button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this portfolio and all its
                      trades.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => handleDelete(p.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Link href={`/portfolio/${p.id}`}>
                <CardContent className="p-4 space-y-2 cursor-pointer">
                  <h2 className="text-lg font-semibold text-green-600 mt-4">
                    {p.name || "Unnamed Portfolio"}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Starting Capital: ${p.startingCapital.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Current Capital: ${p.currentCapital.toLocaleString()}
                  </p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
