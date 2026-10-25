import { NextRequest, NextResponse } from 'next/server';
import { getStoredBenchmarkReport, runBenchmarkSuite } from '@/lib/evaluation/benchmarkRunner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const report = getStoredBenchmarkReport();
    if (!report) {
      return NextResponse.json({
        evaluated: false,
        message: 'Benchmark has not been run yet. Run the evaluation suite to measure metrics.',
      });
    }

    return NextResponse.json({
      evaluated: true,
      report,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        evaluated: false,
        error: error.message || 'Failed to retrieve benchmark report.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const baseUrl = process.env.FLOWPILOT_BASE_URL || 'http://localhost:3000';
    const report = await runBenchmarkSuite(baseUrl);

    return NextResponse.json({
      evaluated: true,
      report,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        evaluated: false,
        error: error.message || 'Benchmark execution failed.',
      },
      { status: 500 }
    );
  }
}
