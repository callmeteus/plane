/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "@plane/i18n";
// plane types
import { Button } from "@makeplane/propel/components/button";
import type { TIssueLinkEditableFields, TIssueServiceType } from "@plane/types";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { InputField } from "@makeplane/propel/components/input-field";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// jira-clone: seletor de arquivos do Google Drive
import { abrirDrivePicker, driveConfig } from "@/lib/drive-picker";
// types
import type { TLinkOperations } from "./root";

export type TLinkOperationsModal = Exclude<TLinkOperations, "remove">;

export type TIssueLinkCreateFormFieldOptions = TIssueLinkEditableFields & {
  id?: string;
};

export type TIssueLinkCreateEditModal = {
  isModalOpen: boolean;
  handleOnClose?: () => void;
  linkOperations: TLinkOperationsModal;
  issueServiceType: TIssueServiceType;
};

const defaultValues: TIssueLinkCreateFormFieldOptions = {
  title: "",
  url: "",
};

export const IssueLinkCreateUpdateModal = observer(function IssueLinkCreateUpdateModal(
  props: TIssueLinkCreateEditModal
) {
  const { isModalOpen, handleOnClose, linkOperations, issueServiceType } = props;
  // i18n
  const { t } = useTranslation();
  // react hook form
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    control,
    reset,
    setValue,
  } = useForm<TIssueLinkCreateFormFieldOptions>({
    defaultValues,
  });
  // store hooks
  const { issueLinkData: preloadedData, setIssueLinkData } = useIssueDetail(issueServiceType);

  // jira-clone: seletor de arquivos do Google Drive
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState("");
  const driveCfg = driveConfig();

  const handleDrivePick = async (onChangeUrl: (v: string) => void, onChangeTitle?: (v: string) => void) => {
    if (!driveCfg) {
      setDriveError("Configure VITE_GOOGLE_DRIVE_API_KEY e VITE_GOOGLE_DRIVE_APP_ID no build.");
      return;
    }
    setDriveError("");
    setDriveLoading(true);
    try {
      // O token OAuth e obtido via gapi ao carregar a API; o Picker usa-o.
      const gapi = (window as any).gapi;
      const token = gapi?.auth?.getAuthInstance()?.currentUser?.get()?.getAuthResponse()?.access_token;
      if (!token) {
        setDriveError("Entre com o Google para anexar arquivos do Drive.");
        return;
      }
      const file = await abrirDrivePicker(driveCfg, token);
      if (file) {
        onChangeUrl(file.url);
        onChangeTitle?.(file.name);
      }
    } catch (e) {
      setDriveError(e instanceof Error ? e.message : "Erro ao abrir o Drive");
    } finally {
      setDriveLoading(false);
    }
  };

  const onClose = () => {
    setIssueLinkData(null);
    if (handleOnClose) handleOnClose();
  };

  const handleFormSubmit = async (formData: TIssueLinkCreateFormFieldOptions) => {
    const parsedUrl = formData.url.startsWith("http") ? formData.url : `http://${formData.url}`;
    try {
      if (!formData || !formData.id) await linkOperations.create({ title: formData.title, url: parsedUrl });
      else await linkOperations.update(formData.id, { title: formData.title, url: parsedUrl });
      onClose();
    } catch (error) {
      console.error("error", error);
    }
  };

  useEffect(() => {
    if (isModalOpen) reset({ ...defaultValues, ...preloadedData });
  }, [preloadedData, reset, isModalOpen]);

  return (
    <Dialog
      open={isModalOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="md">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex min-h-0 flex-1 flex-col">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{preloadedData?.id ? t("common.update_link") : t("common.add_link")}</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody render={<div className="space-y-3" />}>
              {/* jira-clone: anexar arquivo do Google Drive */}
              <div className="flex flex-col gap-1">
                <Button
                  variant="secondary"
                  size="md"
                  stretch="auto"
                  loading={driveLoading}
                  onClick={() =>
                    handleDrivePick(
                      (url) => setValue("url", url),
                      (title) => setValue("title", title)
                    )
                  }
                  label="Anexar do Google Drive"
                />
                {driveError && <p className="text-xs text-danger-primary">{driveError}</p>}
              </div>
              <Controller
                control={control}
                name="url"
                rules={{
                  required: "URL is required",
                }}
                render={({ field: { value, onChange, ref } }) => (
                  <InputField
                    size="lg"
                    orientation="vertical"
                    id="url"
                    type="text"
                    label={t("common.url")}
                    value={value}
                    onChange={onChange}
                    ref={ref}
                    error={errors.url ? t("common.url_is_invalid") : undefined}
                    placeholder={t("common.type_or_paste_a_url")}
                  />
                )}
              />
              <Controller
                control={control}
                name="title"
                render={({ field: { value, onChange, ref } }) => (
                  <InputField
                    size="lg"
                    orientation="vertical"
                    id="title"
                    type="text"
                    label={t("common.display_title")}
                    hint={t("common.optional")}
                    value={value}
                    onChange={onChange}
                    ref={ref}
                    error={errors.title?.message}
                    placeholder={t("common.link_title_placeholder")}
                  />
                )}
              />
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button variant="secondary" size="md" stretch="auto" onClick={onClose} label={t("common.cancel")} />
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              type="submit"
              loading={isSubmitting}
              label={`${
                preloadedData?.id
                  ? isSubmitting
                    ? t("common.updating")
                    : t("common.update")
                  : isSubmitting
                    ? t("common.adding")
                    : t("common.add")
              } ${t("common.link")}`}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
});
