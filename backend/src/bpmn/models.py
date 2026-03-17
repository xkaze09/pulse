"""Pydantic models for the structured BPMN process representation."""

from typing import Literal

from pydantic import BaseModel, Field


class Actor(BaseModel):
    """A process participant that maps to a swimlane."""

    id: str
    name: str
    description: str = ""


class BPMNEvent(BaseModel):
    """A BPMN event (start, end, or intermediate)."""

    id: str
    name: str
    event_type: Literal["start", "end", "intermediate"]
    lane_id: str  # must match an Actor.id


class Activity(BaseModel):
    """A BPMN task/activity."""

    id: str
    name: str
    activity_type: Literal["userTask", "serviceTask", "manualTask"] = "userTask"
    lane_id: str  # must match an Actor.id
    description: str = ""


class Gateway(BaseModel):
    """A BPMN gateway (decision/branching point)."""

    id: str
    name: str
    gateway_type: Literal["exclusive", "parallel", "inclusive"] = "exclusive"
    lane_id: str  # must match an Actor.id


class SequenceFlow(BaseModel):
    """A directed connection between two BPMN elements."""

    id: str
    source_id: str
    target_id: str
    condition_label: str | None = None  # label on gateway outgoing flows


class ProcessFlow(BaseModel):
    """Top-level process model — the complete structured representation."""

    name: str
    description: str = ""
    actors: list[Actor] = Field(min_length=1)
    events: list[BPMNEvent] = Field(default_factory=list)
    activities: list[Activity] = Field(min_length=1)
    gateways: list[Gateway] = Field(default_factory=list)
    sequence_flows: list[SequenceFlow] = Field(default_factory=list)
