import { Surface } from "@/components/ui/Surface";
import { isDraft, rulesSections, type RulesConfig } from "@/lib/rules";
import styles from "./RulesContent.module.css";

/** The official rules, with a "Draft" banner while any sponsor detail is a placeholder (T38). */
export function RulesContent({ config }: { config: RulesConfig }) {
  return (
    <>
      {isDraft(config.sponsor) && (
        <p className={styles.draft} role="note">
          Draft: these rules are not final and the prize draw is not open yet.
        </p>
      )}
      {rulesSections(config).map((section) => (
        <Surface as="section" key={section.heading} aria-label={section.heading}>
          <h2 className={styles.heading}>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </Surface>
      ))}
    </>
  );
}
