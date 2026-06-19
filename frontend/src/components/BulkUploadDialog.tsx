import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  templateColumns: string[];
  onUpload: (data: any[]) => Promise<void>;
  sampleData?: any[];
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  title,
  description,
  templateColumns,
  onUpload,
  sampleData = [],
}: BulkUploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([templateColumns, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, '_')}_template.xlsx`);
    toast.success('Template downloaded successfully');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('No data found in the file');
      }

      setProgress(30);

      // Validate columns
      const firstRow = jsonData[0] as any;
      const fileColumns = Object.keys(firstRow);
      const missingColumns = templateColumns.filter(col => !fileColumns.includes(col));

      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      setProgress(50);

      await onUpload(jsonData);

      setProgress(100);
      toast.success(`Successfully uploaded ${jsonData.length} records`);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
      toast.error(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      setProgress(0);
      e.target.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-4">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-semibold mb-2">Upload Excel File</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Download the template, fill in your data, and upload the file
              </p>
            </div>

            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={downloadTemplate}
                disabled={uploading}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>

              <Button
                type="button"
                variant="default"
                disabled={uploading}
                onClick={() => document.getElementById('bulk-upload-input')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload File'}
              </Button>

              <input
                id="bulk-upload-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
              </div>
            )}
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-sm">Required Columns:</h4>
            <div className="flex flex-wrap gap-2">
              {templateColumns.map((col) => (
                <span key={col} className="text-xs bg-background px-2 py-1 rounded">
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
