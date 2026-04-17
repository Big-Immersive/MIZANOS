"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Progress } from "@/components/atoms/feedback/Progress";
import { Button } from "@/components/molecules/buttons/Button";
import { useIntakeSubmit } from "@/hooks/features/useIntakeSubmit";
import { aiRepository } from "@/lib/api/repositories";
import { useProducts } from "@/hooks/queries/useProducts";
import { extractJsonText } from "@/lib/utils/jsonExtract";
import { StepIndicator } from "@/components/molecules/intake/StepIndicator";

import { IntakeBasicInfo } from "./IntakeBasicInfo";
import { IntakeSourcesStep } from "./IntakeSourcesStep";
import { IntakeSpecReview } from "./IntakeSpecReview";
import { IntakeConfirmation } from "./IntakeConfirmation";
import { buildSourceSummary } from "./intake-utils";
import {
  INTAKE_STEPS,
  type IntakeStep,
  type IntakeFormData,
  type GeneratedSpec,
} from "./types";

export function IntakeForm() {
  const [currentStep, setCurrentStep] = React.useState<IntakeStep>("basic-info");
  const stepIndex = INTAKE_STEPS.indexOf(currentStep);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const [formData, setFormData] = React.useState<IntakeFormData>({
    projectName: "",
    pillar: "",
    sourceType: "greenfield",
    description: "",
    customInstructions: "",
    sources: {
      documents: [],
      audioNotes: [],
      markdownContent: "",
      pasteContent: "",
      scrapedWebsites: [],
      githubData: null,
    },
    generatedSpec: null,
  });

  const { isSubmitting, submitProgress, submitLabel, handleSubmit } = useIntakeSubmit();
  const { data: existingProducts = [] } = useProducts();

  const isDuplicateName = React.useMemo(() => {
    const trimmed = formData.projectName.trim().toLowerCase();
    if (!trimmed) return false;
    return existingProducts.some((p) => p.name?.toLowerCase() === trimmed);
  }, [formData.projectName, existingProducts]);

  const canProceedFromBasicInfo =
    formData.projectName.trim() !== "" && formData.pillar !== "" && !isDuplicateName;

  const hasAnySources =
    formData.sources.documents.length > 0 ||
    formData.sources.audioNotes.length > 0 ||
    formData.sources.markdownContent.trim().length > 0 ||
    formData.sources.pasteContent.trim().length > 0 ||
    formData.sources.scrapedWebsites.length > 0 ||
    !!formData.sources.githubData;

  const goNext = () => {
    const nextIdx = stepIndex + 1;
    if (nextIdx < INTAKE_STEPS.length) setCurrentStep(INTAKE_STEPS[nextIdx]);
  };

  const goBack = () => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) setCurrentStep(INTAKE_STEPS[prevIdx]);
  };

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case "basic-info": return canProceedFromBasicInfo;
      case "sources": return hasAnySources;
      case "spec-review": return formData.generatedSpec !== null;
      default: return false;
    }
  };

  const updateSources = React.useCallback(
    (partial: Partial<IntakeFormData["sources"]>) => {
      setFormData((prev) => ({
        ...prev,
        sources: { ...prev.sources, ...partial },
      }));
    },
    [],
  );

  const handleGenerateSpec = React.useCallback(async () => {
    setIsGenerating(true);
    try {
      const { text: sourceSummary, images } = await buildSourceSummary(formData.sources);
      const prompt = [
        `Generate a comprehensive product specification for "${formData.projectName}".`,
        formData.description ? `Project description: ${formData.description}` : "",
        sourceSummary
          ? [
              "\n=== SOURCE DOCUMENTS (PRIMARY BASIS FOR SPECIFICATION) ===",
              sourceSummary,
              "=== END SOURCE DOCUMENTS ===",
              "\nCRITICAL INSTRUCTIONS:",
              "- The source documents above are the PRIMARY input. Your specification MUST be grounded in their content.",
              "- Extract and incorporate specific features, workflows, terminology, entities, business rules, and domain details from the documents.",
              "- Every user story, business rule, and acceptance criterion should trace back to concrete details found in the sources.",
              "- Do NOT generate generic or placeholder content when the documents provide specific information.",
              "- If the documents describe specific screens, APIs, data models, or integrations, include those details verbatim.",
            ].join("\n")
          : "",
        images.length > 0
          ? "\nThe attached images are uploaded source documents. Thoroughly analyze their visual content (text, diagrams, wireframes, screenshots) and incorporate all relevant details into the specification."
          : "",
        formData.customInstructions?.trim()
          ? `\nCustom Instructions from the user:\n${formData.customInstructions}`
          : "",
        "\nRespond ONLY with valid JSON (no markdown, no code fences) in this exact format:",
        JSON.stringify({
          summary: "High-level product summary",
          functionalSpec: {
            userStories: ["As a [user], I want [goal] so that [benefit]"],
            businessRules: ["Rule describing business logic"],
            acceptanceCriteria: ["Testable acceptance criterion"],
          },
          technicalSpec: {
            architecture: "Description of system architecture",
            dataModels: ["Model/entity description"],
            integrations: ["External service or API integration"],
            nonFunctionalRequirements: ["Performance, security, or scalability requirement"],
          },
          features: ["Feature name or description"],
          techStack: ["Technology name"],
          qaChecklist: ["QA test or check item"],
        }),
      ]
        .filter(Boolean)
        .join("\n");

      const session = await aiRepository.createSession();
      let content = "";
      try {
        const response = await aiRepository.sendMessage(session.id, prompt, images.length > 0 ? images : undefined);
        content = response.content ?? "";
      } finally {
        aiRepository.deleteSession(session.id).catch(() => {});
      }

      let parsed: GeneratedSpec;
      try {
        const raw = JSON.parse(extractJsonText(content));
        parsed = {
          summary: raw.summary ?? content.slice(0, 500),
          functionalSpec: raw.functionalSpec ?? { userStories: [], businessRules: [], acceptanceCriteria: [] },
          technicalSpec: raw.technicalSpec ?? { architecture: "", dataModels: [], integrations: [], nonFunctionalRequirements: [] },
          features: raw.features ?? [],
          techStack: raw.techStack ?? [],
          qaChecklist: raw.qaChecklist ?? [],
        };
      } catch {
        parsed = {
          summary: content.slice(0, 500),
          functionalSpec: { userStories: [], businessRules: [], acceptanceCriteria: [] },
          technicalSpec: { architecture: "", dataModels: [], integrations: [], nonFunctionalRequirements: [] },
          features: ["(AI response could not be parsed — review raw output above)"],
          techStack: [],
          qaChecklist: [],
        };
      }

      setFormData((prev) => ({ ...prev, generatedSpec: parsed }));
      toast.success("Specification generated successfully");
    } catch {
      toast.error("Failed to generate specification");
    } finally {
      setIsGenerating(false);
    }
  }, [formData.projectName, formData.description, formData.sources, formData.customInstructions]);

  const progressPercent = ((stepIndex + 1) / INTAKE_STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Project Intake</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new project by providing specification documents, notes, or pasted content.
        </p>
      </div>

      <StepIndicator steps={INTAKE_STEPS} currentIndex={stepIndex} onStepClick={setCurrentStep} />
      <Progress value={progressPercent} className="h-1" />

      {currentStep === "basic-info" && (
        <IntakeBasicInfo
          projectName={formData.projectName}
          onProjectNameChange={(v) => setFormData((p) => ({ ...p, projectName: v }))}
          description={formData.description}
          onDescriptionChange={(v) => setFormData((p) => ({ ...p, description: v }))}
          pillar={formData.pillar}
          onPillarChange={(v) => setFormData((p) => ({ ...p, pillar: v }))}
          sourceType={formData.sourceType}
          onSourceTypeChange={(v) => setFormData((p) => ({ ...p, sourceType: v }))}
          errors={isDuplicateName ? { projectName: "A project with this name already exists" } : {}}
        />
      )}
      {currentStep === "sources" && (
        <IntakeSourcesStep
          documents={formData.sources.documents}
          onDocumentsChange={(f) => updateSources({ documents: f })}
          audioNotes={formData.sources.audioNotes}
          onAudioNotesChange={(n) => updateSources({ audioNotes: n })}
          markdownContent={formData.sources.markdownContent}
          onMarkdownContentChange={(v) => updateSources({ markdownContent: v })}
          pasteContent={formData.sources.pasteContent}
          onPasteContentChange={(v) => updateSources({ pasteContent: v })}
          scrapedWebsites={formData.sources.scrapedWebsites}
          onScrapedWebsitesChange={(s) => updateSources({ scrapedWebsites: s })}
          githubData={formData.sources.githubData}
          onGitHubDataChange={(d) => updateSources({ githubData: d })}
        />
      )}
      {currentStep === "spec-review" && (
        <IntakeSpecReview
          generatedSpec={formData.generatedSpec}
          onSpecChange={(spec) => setFormData((p) => ({ ...p, generatedSpec: spec }))}
          sources={formData.sources}
          projectName={formData.projectName}
          isGenerating={isGenerating}
          onGenerate={handleGenerateSpec}
          customInstructions={formData.customInstructions}
          onCustomInstructionsChange={(v) => setFormData((p) => ({ ...p, customInstructions: v }))}
        />
      )}
      {currentStep === "confirmation" && (
        <IntakeConfirmation
          formData={formData}
          isSubmitting={isSubmitting}
          submitProgress={submitProgress}
          submitLabel={submitLabel}
          onSubmit={() => handleSubmit(formData)}
        />
      )}

      {!isSubmitting && (
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          {currentStep !== "confirmation" && (
            <Button onClick={goNext} disabled={!canGoNext()}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
