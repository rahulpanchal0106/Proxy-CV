"use client";

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", color: "#333" },
  header: { marginBottom: 15, borderBottom: "1 solid #ccc", paddingBottom: 10 },
  candidateName: {
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 0.5,
    color: "#111",
  },
  candidateId: {
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#555",
  },
  contactRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, gap: 12 },
  contactItem: { fontSize: 9, color: "#555", marginRight: 10 },
  summary: { fontSize: 10, lineHeight: 1.5, marginTop: 10, color: "#555" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionBody: { marginBottom: 10 },
  itemContainer: { marginBottom: 10 },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  itemTitle: { fontSize: 10, fontWeight: "bold" },
  itemDate: { fontSize: 9, color: "#666" },
  itemSub: { fontSize: 9, fontStyle: "italic", color: "#444", marginBottom: 3 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletPoint: { width: 10, fontSize: 9, textAlign: "center" },
  bulletText: { flex: 1, fontSize: 9, lineHeight: 1.4 },
  skills: { fontSize: 9, lineHeight: 1.5 },
});

// Helper Components
const BulletPoint = ({ text }: { text: string }) => (
  <View style={styles.bullet}>
    <Text style={styles.bulletPoint}>•</Text>
    <Text style={styles.bulletText}>{text}</Text>
  </View>
);

const ExperienceItem = ({ exp }: { exp: any }) => (
  <View style={styles.itemContainer}>
    <View style={styles.itemHeader}>
      <Text style={styles.itemTitle}>{exp.role}</Text>
      <Text style={styles.itemDate}>{exp.duration}</Text>
    </View>
    {exp.company && (
      <Text style={styles.itemSub}>
        {exp.company} {exp.location ? `- ${exp.location}` : ""}
      </Text>
    )}
    {exp.bulletPoints &&
      exp.bulletPoints.map((point: string, idx: number) => (
        <BulletPoint key={idx} text={point} />
      ))}
  </View>
);

const ProjectItem = ({ proj }: { proj: any }) => (
  <View style={styles.itemContainer}>
    <View style={styles.itemHeader}>
      <Text style={styles.itemTitle}>
        {proj.name} {proj.role ? `| ${proj.role}` : ""}
      </Text>
      <Text style={styles.itemDate}>{proj.duration}</Text>
    </View>
    {proj.technologies && proj.technologies.length > 0 && (
      <Text style={styles.itemSub}>
        Tech Stack: {proj.technologies.join(", ")}
      </Text>
    )}
    {proj.bulletPoints &&
      proj.bulletPoints.map((point: string, idx: number) => (
        <BulletPoint key={idx} text={point} />
      ))}
  </View>
);

const EducationItem = ({ edu }: { edu: any }) => (
  <View style={styles.itemContainer}>
    <View style={styles.itemHeader}>
      <Text style={styles.itemTitle}>{edu.degree}</Text>
      <Text style={styles.itemDate}>{edu.year}</Text>
    </View>
    <Text style={styles.itemSub}>{edu.institution}</Text>
  </View>
);

const CertItem = ({ cert }: { cert: any }) => (
  <View style={styles.itemContainer}>
    <View style={styles.itemHeader}>
      <Text style={styles.itemTitle}>{cert.name}</Text>
      <Text style={styles.itemDate}>{cert.year}</Text>
    </View>
    <Text style={styles.itemSub}>{cert.issuer}</Text>
  </View>
);

// --- MAIN DOCUMENT ---
export default function RedactedResumePDF({
  data,
  sections,
  showOriginalName,
}: {
  data: any;
  sections: any;
  showOriginalName: boolean;
}) {
  if (!data || !sections) return null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Block */}
        <View style={styles.header} wrap={false}>
          {sections.name &&
            (showOriginalName && data.fullName ? (
              <Text style={styles.candidateName}>{data.fullName}</Text>
            ) : (
              <Text style={styles.candidateId}>
                Candidate ID: {data.candidateId || "REDACTED"}
              </Text>
            ))}

          {/* NEW: Split Contact and Location Info */}
          {(sections.contact || sections.location) && data.contactInfo && (
            <View style={styles.contactRow}>
              {sections.contact && data.contactInfo.email && (
                <Text style={styles.contactItem}>{data.contactInfo.email}</Text>
              )}
              {sections.contact && data.contactInfo.phone && (
                <Text style={styles.contactItem}>{data.contactInfo.phone}</Text>
              )}
              {sections.location && data.contactInfo.location && (
                <Text style={styles.contactItem}>
                  {data.contactInfo.location}
                </Text>
              )}
            </View>
          )}

          {sections.summary && data.professionalSummary && (
            <Text style={styles.summary}>{data.professionalSummary}</Text>
          )}
        </View>

        {sections.skills && data.topSkills && data.topSkills.length > 0 && (
          <View style={styles.sectionBody} wrap={false}>
            <Text style={styles.sectionTitle}>Technical Skills</Text>
            <Text style={styles.skills}>{data.topSkills.join(" • ")}</Text>
          </View>
        )}

        {sections.experience &&
          data.experience &&
          data.experience.length > 0 && (
            <View style={styles.sectionBody}>
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Experience</Text>
                <ExperienceItem exp={data.experience[0]} />
              </View>
              {data.experience.slice(1).map((exp: any, index: number) => (
                <View wrap={false} key={index + 1}>
                  <ExperienceItem exp={exp} />
                </View>
              ))}
            </View>
          )}

        {sections.projects && data.projects && data.projects.length > 0 && (
          <View style={styles.sectionBody}>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Projects</Text>
              <ProjectItem proj={data.projects[0]} />
            </View>
            {data.projects.slice(1).map((proj: any, index: number) => (
              <View wrap={false} key={index + 1}>
                <ProjectItem proj={proj} />
              </View>
            ))}
          </View>
        )}

        {sections.education && data.education && data.education.length > 0 && (
          <View style={styles.sectionBody}>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Education</Text>
              <EducationItem edu={data.education[0]} />
            </View>
            {data.education.slice(1).map((edu: any, index: number) => (
              <View wrap={false} key={index + 1}>
                <EducationItem edu={edu} />
              </View>
            ))}
          </View>
        )}

        {sections.certifications &&
          data.certifications &&
          data.certifications.length > 0 && (
            <View style={styles.sectionBody}>
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Certifications</Text>
                <CertItem cert={data.certifications[0]} />
              </View>
              {data.certifications.slice(1).map((cert: any, index: number) => (
                <View wrap={false} key={index + 1}>
                  <CertItem cert={cert} />
                </View>
              ))}
            </View>
          )}

        {sections.additional &&
          data.additionalSections &&
          data.additionalSections.length > 0 &&
          data.additionalSections.map((sec: any, idx: number) => (
            <View key={idx} style={styles.sectionBody}>
              <View wrap={false}>
                <Text style={styles.sectionTitle}>{sec.title}</Text>
                {sec.content && sec.content.length > 0 && (
                  <BulletPoint text={sec.content[0]} />
                )}
              </View>
              {sec.content &&
                sec.content.slice(1).map((point: string, cIdx: number) => (
                  <View wrap={false} key={cIdx + 1}>
                    <BulletPoint text={point} />
                  </View>
                ))}
            </View>
          ))}
      </Page>
    </Document>
  );
}
