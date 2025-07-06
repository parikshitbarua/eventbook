import { Request, Response } from "express";
import prisma from "../config/database";

interface UpsertUserRequestBody {
  user_id: string;
  wallet_address?: string;
  event_type?: string;
  event_name?: string;
  event_data?: any;
  page_url?: string;
  user_agent?: string;
  ip_address?: string;
}

export const upsertUserTrackEventsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      user_id,
      wallet_address,
      event_type = "page_view",
      event_name = "landing_page_view",
      event_data,
      page_url,
      user_agent,
      ip_address
    }: UpsertUserRequestBody = req.body;

    if (!user_id) {
      res.status(400).json({
        data: null,
        message: "user_id is required"
      });
      return;
    }

    const user = await prisma.user.upsert({
      where: {
        user_id: user_id
      },
      update: {
        wallet_address: wallet_address || null,
        updated_at: new Date()
      },
      create: {
        user_id: user_id,
        wallet_address: wallet_address || null
      }
    });

    const event = await prisma.userEvent.create({
      data: {
        user_id: user.user_id,
        event_type,
        event_name,
        event_data: event_data || null,
        page_url,
        user_agent,
        ip_address
      }
    });

    res.status(200).json({
      data: {
        user: {
          id: user.id,
          user_id: user.user_id,
          wallet_address: user.wallet_address,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        event: {
          id: event.id,
          event_type: event.event_type,
          event_name: event.event_name,
          created_at: event.created_at
        }
      },
      message: user.wallet_address 
        ? "User wallet address updated and event tracked successfully"
        : "User created and event tracked successfully"
    });

  } catch (error: any) {
    console.error("Error in upsertUserTrackEventsController:", error);
    
    // Handle specific Prisma errors
    if (error?.code === 'P2002') {
      res.status(409).json({
        data: null,
        message: "User with this wallet address already exists"
      });
      return;
    }

    res.status(500).json({
      data: null,
      message: "Internal server error while processing user event"
    });
  }
};

export const newEventTrackEventController = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      user_id,
      event_type,
      event_name,
      event_data,
      page_url,
      user_agent,
      ip_address
    }: UpsertUserRequestBody = req.body;

    // Validate required fields
    if (!user_id) {
      res.status(400).json({
        data: null,
        message: "user_id is required"
      });
      return;
    }

    if (!event_type || !event_name) {
      res.status(400).json({
        data: null,
        message: "event_type and event_name are required"
      });
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { user_id }
    });

    if (!existingUser) {
      res.status(404).json({
        data: null,
        message: "User not found"
      });
      return;
    }

    // Create event record
    const event = await prisma.userEvent.create({
      data: {
        user_id,
        event_type,
        event_name,
        event_data: event_data || null,
        page_url,
        user_agent,
        ip_address
      }
    });

    res.status(200).json({
      data: {
        event: {
          id: event.id,
          event_type: event.event_type,
          event_name: event.event_name,
          created_at: event.created_at
        }
      },
      message: "Event tracked successfully"
    });

  } catch (error: any) {
    console.error("Error in newEventTrackEventController:", error);
    
    res.status(500).json({
      data: null,
      message: "Internal server error while tracking event"
    });
  }
};
