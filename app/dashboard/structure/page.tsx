"use client"
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, List } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StructurePage() {
    const route = useRouter()
    return (
      <div className="flex-1 w-full flex flex-col gap-12">
        <div className="flex flex-row gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform</CardTitle>
              <CardDescription>Structures from platform</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                type="button"
                onClick={() => route.push('/dashboard/structure/platform/new')}
              >
                <PlusCircle />
                New Platform
              </Button>
              <Button
                type="button"
                onClick={() => route.push('/dashboard/structure/platform')}
                className="ml-2"
              >
                <List />
                View Platforms
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>Structures from pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                type="button"
                onClick={() => route.push('/dashboard/structure/pipeline/new')}
              >
                <PlusCircle />
                New Pipeline
              </Button>
              <Button
                type="button"
                onClick={() => route.push('/dashboard/structure/pipeline')}
                className="ml-2"
              >
                <List />
                View Pipelines
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }