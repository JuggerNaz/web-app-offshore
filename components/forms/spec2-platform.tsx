import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { Button } from "@/components/ui/button";
import { Form,FormControl,FormField,FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { fetcher } from "@/utils/utils";
import { Separator } from "@/components/ui/separator";
import { RowWrap } from "@/components/forms/utils";
import useSWR from "swr";

// Define schema for platform specifications
const PlatformSpecificationsSchema = z.object({
    platform_id: z.number(),
    elevations: z.object({
        aboveSplash: z.array(z.number()),
        belowSplash: z.array(z.number())
    }),
    levels: z.array(z.object({
        name: z.string(),
        startElevation: z.number(),
        endElevation: z.number()
    })),
    faces: z.array(z.object({
        name: z.string(),
        from: z.string(),
        to: z.string()
    }))
});

export default function Spec2Platform() {
    const [pageId, setPageId] = useAtom(urlId);
    const [pageType, setPageType] = useAtom(urlType);
    
    // Form setup with default values
    const form = useForm<z.infer<typeof PlatformSpecificationsSchema>>({
        resolver: zodResolver(PlatformSpecificationsSchema),
        defaultValues: {
            platform_id: pageId,
            elevations: {
                aboveSplash: [],
                belowSplash: []
            },
            levels: [],
            faces: []
        }
    });
    
    // Use SWR for data fetching
    const { data: specData, error, isLoading } = useSWR(
        pageId ? `/api/platform/specifications?platformId=${pageId}` : null,
        fetcher,
        {
            onSuccess: (data) => {
                if (data && data.data) {
                    form.reset({
                        platform_id: pageId,
                        ...data.data
                    });
                }
            }
        }
    );
    
    // Get current form values
    const { elevations, levels, faces } = form.watch();
    
    // Functions to handle platform elevations
    const handleAddAboveSplashElevation = () => {
        const currentElevations = form.getValues("elevations.aboveSplash");
        form.setValue("elevations.aboveSplash", [...currentElevations, 0.000]);
    };
    
    const handleDeleteAboveSplashElevation = () => {
        const currentElevations = form.getValues("elevations.aboveSplash");
        if (currentElevations.length > 0) {
            form.setValue("elevations.aboveSplash", currentElevations.slice(0, -1));
        }
    };
    
    const handleAddBelowSplashElevation = () => {
        const currentElevations = form.getValues("elevations.belowSplash");
        form.setValue("elevations.belowSplash", [...currentElevations, 0.000]);
    };
    
    const handleDeleteBelowSplashElevation = () => {
        const currentElevations = form.getValues("elevations.belowSplash");
        if (currentElevations.length > 0) {
            form.setValue("elevations.belowSplash", currentElevations.slice(0, -1));
        }
    };
    
    // Functions to handle levels
    const handleAddLevel = () => {
        const currentLevels = form.getValues("levels");
        const newLevel = {
            name: `Level ${currentLevels.length + 1}`,
            startElevation: currentLevels.length > 0 ? currentLevels[currentLevels.length - 1].endElevation : 0,
            endElevation: currentLevels.length > 0 ? currentLevels[currentLevels.length - 1].endElevation - 10 : -10
        };
        form.setValue("levels", [...currentLevels, newLevel]);
    };
    
    const handleDeleteLevel = () => {
        const currentLevels = form.getValues("levels");
        if (currentLevels.length > 0) {
            form.setValue("levels", currentLevels.slice(0, -1));
        }
    };
    
    // Functions to handle faces
    const handleAddFace = () => {
        const currentFaces = form.getValues("faces");
        const newFace = {
            name: `Row ${currentFaces.length + 1}`,
            from: 'A1',
            to: 'B1'
        };
        form.setValue("faces", [...currentFaces, newFace]);
    };
    
    const handleDeleteFace = () => {
        const currentFaces = form.getValues("faces");
        if (currentFaces.length > 0) {
            form.setValue("faces", currentFaces.slice(0, -1));
        }
    };
    
    // Function to save specifications
    const onSubmit = async (values: z.infer<typeof PlatformSpecificationsSchema>) => {
        try {
            // Save specifications to database
            const response = await fetcher('/api/platform/specifications', {
                method: 'POST',
                body: JSON.stringify(values)
            });
            
            toast.success('Platform specifications saved successfully!');
        } catch (error) {
            console.error('Error saving specifications:', error);
            toast.error('Failed to save platform specifications.');
        }
    };

    // Show loading state
    if (isLoading) return <div>Loading specifications...</div>;
    
    // Show error state
    if (error) return <div>Error loading specifications: {error.message}</div>;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Display information about loaded data */}
                {specData && (
                    <div className="bg-blue-50 p-4 rounded-md mb-4">
                        <h3 className="font-medium text-blue-700 mb-2">Data loaded from database</h3>
                        <p className="text-sm text-blue-600">
                            Platform ID: {pageId} | 
                            Elevations: {specData.data?.elevations?.aboveSplash?.length || 0} above splash, {specData.data?.elevations?.belowSplash?.length || 0} below splash | 
                            Levels: {specData.data?.levels?.length || 0} | 
                            Faces: {specData.data?.faces?.length || 0}
                        </p>
                    </div>
                )}
                
                <div className="space-y-6">
                    <RowWrap className="gap-4">
                        {/* LEFT SIDE: Platform Elevations */}
                        <div className="w-1/2">
                            <div className="border rounded p-4">
                                <h3 className="font-medium border-b pb-1 mb-3">Platform Elevations (m)</h3>
                                <div className="flex">
                                    <div className="flex-1 flex gap-4">
                                        {/* Above Splash Level */}
                                        <div className="w-1/2">
                                            <div className="font-medium mb-2">Above Splash Level:</div>
                                            <div className="h-[200px] overflow-y-auto pr-2">
                                                {elevations.aboveSplash.map((elevation, index) => (
                                                    <FormField
                                                        key={`above-${index}`}
                                                        control={form.control}
                                                        name={`elevations.aboveSplash.${index}`}
                                                        render={({ field }) => (
                                                            <FormItem className="mb-2">
                                                                <FormControl>
                                                                    <Input 
                                                                        type="number" 
                                                                        step="0.001" 
                                                                        className="text-center border" 
                                                                        {...field} 
                                                                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {/* Below Splash Level */}
                                        <div className="w-1/2">
                                            <div className="font-medium mb-2">Below Splash Level:</div>
                                            <div className="h-[200px] overflow-y-auto pr-2">
                                                {elevations.belowSplash.map((elevation, index) => (
                                                    <FormField
                                                        key={`below-${index}`}
                                                        control={form.control}
                                                        name={`elevations.belowSplash.${index}`}
                                                        render={({ field }) => (
                                                            <FormItem className="mb-2">
                                                                <FormControl>
                                                                    <Input 
                                                                        type="number" 
                                                                        step="0.001" 
                                                                        className="text-center border" 
                                                                        {...field} 
                                                                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex mt-2">
                                    <div className="w-1/2 flex">
                                        <Button 
                                            type="button"
                                            onClick={handleAddAboveSplashElevation}
                                            variant="outline"
                                            className="flex-1 mr-1"
                                        >
                                            Add
                                        </Button>
                                        <Button 
                                            type="button"
                                            onClick={handleDeleteAboveSplashElevation}
                                            variant="outline"
                                            className="flex-1 mr-1"
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                    <div className="w-1/2 flex ml-4">
                                        <Button 
                                            type="button"
                                            onClick={handleAddBelowSplashElevation}
                                            variant="outline"
                                            className="flex-1 mr-1"
                                        >
                                            Add
                                        </Button>
                                        <Button 
                                            type="button"
                                            onClick={handleDeleteBelowSplashElevation}
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* RIGHT SIDE: Levels and Faces */}
                        <div className="w-1/2">
                            {/* Levels Section */}
                            <div className="border rounded p-4 mb-4">
                                <h3 className="font-medium border-b pb-1 mb-3">Levels</h3>
                                <div className="flex">
                                    <div className="flex-1">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="text-left">
                                                        <th className="w-10 pr-2"></th>
                                                        <th className="pr-2">Level Name</th>
                                                        <th className="pr-2">Start Elevation</th>
                                                        <th className="pr-2">End Elevation</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {levels.map((level, index) => (
                                                        <tr key={`level-${index}`}>
                                                            <td className="pr-2">{index + 1}.</td>
                                                            <td className="pr-2">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`levels.${index}.name`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="mb-1">
                                                                            <FormControl>
                                                                                <Input 
                                                                                    {...field} 
                                                                                    className="border"
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </td>
                                                            <td className="pr-2">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`levels.${index}.startElevation`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="mb-1">
                                                                            <FormControl>
                                                                                <Input 
                                                                                    type="number" 
                                                                                    step="0.001" 
                                                                                    {...field} 
                                                                                    className="border"
                                                                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </td>
                                                            <td className="pr-2">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`levels.${index}.endElevation`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="mb-1">
                                                                            <FormControl>
                                                                                <Input 
                                                                                    type="number" 
                                                                                    step="0.001" 
                                                                                    {...field} 
                                                                                    className="border"
                                                                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="ml-4 flex flex-col space-y-2">
                                        <Button 
                                            type="button" 
                                            onClick={handleAddLevel}
                                            variant="outline"
                                            className="w-20"
                                        >
                                            Add
                                        </Button>
                                        <Button 
                                            type="button" 
                                            onClick={handleDeleteLevel}
                                            variant="outline"
                                            className="w-20"
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Faces Section */}
                            <div className="border rounded p-4">
                                <h3 className="font-medium border-b pb-1 mb-3">Faces</h3>
                                <div className="flex">
                                    <div className="flex-1">
                                        <div className="overflow-x-auto max-h-[200px]">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="text-left">
                                                        <th className="w-10 pr-2"></th>
                                                        <th className="pr-2">Name</th>
                                                        <th className="pr-2">From</th>
                                                        <th className="pr-2">To</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {faces.map((face, index) => (
                                                        <tr key={`face-${index}`}>
                                                            <td className="pr-2">{index + 1}.</td>
                                                            <td className="pr-2">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`faces.${index}.name`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="mb-1">
                                                                            <FormControl>
                                                                                <Input 
                                                                                    {...field} 
                                                                                    className="border"
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </td>
                                                            <td className="pr-2">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`faces.${index}.from`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="mb-1">
                                                                            <FormControl>
                                                                                <Input 
                                                                                    {...field} 
                                                                                    className="border"
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </td>
                                                            <td className="pr-2">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`faces.${index}.to`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="mb-1">
                                                                            <FormControl>
                                                                                <Input 
                                                                                    {...field} 
                                                                                    className="border"
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="ml-4 flex flex-col space-y-2">
                                        <Button 
                                            type="button" 
                                            onClick={handleAddFace}
                                            variant="outline"
                                            className="w-20"
                                        >
                                            Add
                                        </Button>
                                        <Button 
                                            type="button" 
                                            onClick={handleDeleteFace}
                                            variant="outline"
                                            className="w-20"
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </RowWrap>
                </div>
                
                <Separator />
                
                <Button type="submit">Submit</Button>
            </form>
        </Form>
    );
}