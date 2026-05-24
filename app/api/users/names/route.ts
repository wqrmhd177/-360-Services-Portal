import { NextResponse } from "next/server";
import { getUserNames } from "@/lib/getUserName";

export async function POST(request: Request) {
  try {
    const { emails } = await request.json();

    if (!Array.isArray(emails)) {
      return NextResponse.json(
        { error: "emails must be an array" },
        { status: 400 }
      );
    }

    const userNames = await getUserNames(emails);
    
    // Convert Map to object for JSON serialization
    const namesObject: Record<string, string> = {};
    userNames.forEach((name, email) => {
      namesObject[email] = name;
    });

    return NextResponse.json({ names: namesObject });
  } catch (error) {
    console.error("Error fetching user names:", error);
    return NextResponse.json(
      { error: "Failed to fetch user names" },
      { status: 500 }
    );
  }
}
